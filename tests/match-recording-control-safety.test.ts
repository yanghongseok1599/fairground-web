import assert from "node:assert/strict";
import test from "node:test";
import { blockingPendingCount, createObservedClock, finalizationWaitMessage, observeOtherPending, otherPendingCount } from "../src/features/match-recording/control-safety.ts";
import { projectRoom, reconcileSnapshot, type RecordingRoom, type RecordingCommand } from "../src/features/match-recording/model.ts";
import { flushRoom } from "../src/features/match-recording/sync-core.ts";
import { mergeKnownPending } from "../src/features/match-recording/presence-pending.ts";

const command = (id: string, kind: RecordingCommand["kind"], payload: RecordingCommand["payload"] = {}): RecordingCommand => ({ id, kind, payload, at: 100 });
const room = (): RecordingRoom => ({
  key: "admin:match", actorId: "admin", matchId: "match", revision: 1, savedAt: 0, players: [], lineups: [], journal: [], pending: [],
  base: { id: "match", tournamentId: "tournament", round: 1, homeTeamId: "home", awayTeamId: "away", homeTeamName: "홈", awayTeamName: "원정", homeScore: 0, awayScore: 0, status: "live", scheduledAt: 0, events: [], elapsedSeconds: 30, currentHalf: 1, isRunning: true, serverRevision: 1, clock: { version: 1, ownerId: "referee", deviceId: "referee-device", ownerName: "심판" } },
});
const goal = { type: "goal", playerId: "player", playerName: "선수", teamId: "home", minute: 3, half: 1 };

test("backup operator pause/end preserves the displayed final second without owning periodic writes", () => {
  for (const kind of ["pause", "end"] as const) {
    const r = room();
    const clock = createObservedClock();
    clock.remember(34, 1, 1);
    r.pending = [command(kind, kind, { ...clock.payload(r.base), _clockVersion: 1, _deviceId: "admin-device" })];
    const projected = projectRoom(r);
    assert.equal(projected.elapsedSeconds, 34);
    assert.equal(projected.isRunning, false);
    assert.equal(projected.clock?.ownerId, "admin");
    assert.equal(projected.status, kind === "end" ? "finished" : "live");
  }
});

test("last observed clock cannot jump a new control version, rewind, or exceed regulation", () => {
  const clock = createObservedClock();
  const r = room();
  clock.remember(600, 1, 1);
  r.base.clock!.version = 2;
  assert.equal(clock.payload(r.base)._elapsedSeconds, 30);
  clock.remember(10, 1, 2);
  assert.equal(clock.payload(r.base)._elapsedSeconds, 30);
  clock.remember(999.5, 2, 2);
  assert.deepEqual(clock.payload(r.base), { _elapsedSeconds: 720, _half: 2 });
  r.base.currentHalf = 2;
  r.pending = [command("pause", "pause", { _elapsedSeconds: 40, _half: 1 })];
  assert.equal(projectRoom(r).currentHalf, 2);
});

test("superseded pause is acknowledged visibly and does not block the following goal", async () => {
  let r = room();
  r.pending = [command("old-pause", "pause", { _clockVersion: 1 }), command("goal", "event", goal)];
  r.journal = structuredClone(r.pending);
  r.base.clock!.version = 3;
  const sent: string[] = [];
  await flushRoom(r, {
    currentActor: () => "admin", update: async (_key, change) => r = change(r),
    send: async (_match, c) => {
      sent.push(c.id);
      const next = projectRoom({ ...r, pending: c.kind === "pause" ? [] : [c] });
      return { ...next, serverRevision: (r.base.serverRevision ?? 0) + 1, appliedOperationIds: [...(r.base.appliedOperationIds ?? []), c.id], supersededOperationIds: ["old-pause"] };
    },
  });
  assert.deepEqual(sent, ["old-pause", "goal"]);
  assert.equal(r.pending.length, 0);
  assert.equal(r.base.homeScore, 1);
  assert.equal(r.base.isRunning, true);
  assert.match(r.notice!, /일시정지·재개 요청 1건은 반영하지 않았습니다/);
  assert.deepEqual(r.journal.map(c => c.id), ["old-pause", "goal"]);
  assert.equal(r.blocked, false);
});

test("realtime superseded acknowledgement survives a lost response and a later snapshot", async () => {
  let r = room();
  r.pending = [command("resume", "resume", { _clockVersion: 0 })];
  r.journal = structuredClone(r.pending);
  await flushRoom(r, {
    currentActor: () => "admin", update: async (_key, change) => r = change(r),
    send: async () => {
      r = reconcileSnapshot(r, { ...r.base, serverRevision: 2, appliedOperationIds: ["resume"], supersededOperationIds: ["resume"] });
      throw { code: "22023" };
    },
  });
  assert.equal(r.pending.length, 0);
  assert.notEqual(r.blocked, true);
  assert.ok(r.notice);
  const notice = r.notice;
  r = reconcileSnapshot(r, { ...r.base, serverRevision: 3 });
  assert.equal(r.notice, notice);
  assert.equal(r.journal.length, 1);
});

test("stale end remains blocked for review and is never treated as a superseded pause", async () => {
  let r = room();
  r.pending = [command("end", "end", { _clockVersion: 0 })];
  await flushRoom(r, { currentActor: () => "admin", update: async (_key, change) => r = change(r), send: async () => { throw { code: "22023" }; } });
  assert.equal(r.pending[0].id, "end");
  assert.equal(r.blocked, true);
  assert.equal(r.notice, undefined);
});

test("finalization rechecks other-device pending after preceding commands and retries after drain", async () => {
  let r = room();
  r.pending = [command("goal", "event", goal), command("end", "end")];
  r.journal = structuredClone(r.pending);
  let peerPending = 0;
  const stop = observeOtherPending(r.matchId, () => peerPending);
  const sent: string[] = [];
  const deps = {
    currentActor: () => "admin", update: async (_key: string, change: (r?: RecordingRoom) => RecordingRoom) => r = change(r),
    waitBeforeSend: (c: RecordingCommand) => finalizationWaitMessage(c.kind, otherPendingCount(r.matchId)),
    send: async (_match: string, c: RecordingCommand) => {
      sent.push(c.id);
      if (c.id === "goal") peerPending = 2;
      return projectRoom({ ...r, pending: [c] });
    },
  };
  try {
    await flushRoom(r, deps);
    assert.deepEqual(sent, ["goal"]);
    assert.equal(r.pending[0].id, "end");
    assert.match(r.error!, /전송 대기 기록 2건/);
    assert.notEqual(r.blocked, true);
    assert.equal(r.base.status, "live");
    assert.ok(finalizationWaitMessage("forfeit", otherPendingCount(r.matchId)));
    peerPending = 0;
    await flushRoom(r, deps);
    assert.deepEqual(sent, ["goal", "end"]);
    assert.equal(r.base.status, "finished");
    assert.equal(r.pending.length, 0);
    assert.equal(r.journal.length, 2);
  } finally { stop(); }
  assert.equal(otherPendingCount(r.matchId), 0);
});

test("two offline end-only queues never wait on each other, while record/control predecessors still gate", async () => {
  const a = room();
  const b = room();
  a.pending = [command("end-a", "end")];
  b.pending = [command("end-b", "end")];
  const state = { a, b };
  const sent: string[] = [];
  await Promise.all((["a", "b"] as const).map(key => flushRoom(state[key], {
    currentActor: () => "admin",
    update: async (_key, change) => state[key] = change(state[key]),
    waitBeforeSend: c => finalizationWaitMessage(c.kind, blockingPendingCount(state[key === "a" ? "b" : "a"].pending)),
    send: async (_match, c) => {
      sent.push(c.id);
      return { ...state[key].base, status: "finished", isRunning: false };
    },
  })));
  assert.deepEqual(sent.sort(), ["end-a", "end-b"]);
  assert.equal(state.a.pending.length + state.b.pending.length, 0);
  assert.equal(blockingPendingCount([command("forfeit", "forfeit")]), 0);
  assert.equal(blockingPendingCount([command("goal", "event", goal), command("pause", "pause"), command("timer", "timer"), command("end", "end")]), 3);
});

test("known unsent peer records survive presence departure until that device explicitly drains", () => {
  const own = "admin:device-a";
  const peer = "referee:device-b";
  let known = mergeKnownPending(new Map(), [{ key: peer, pending: 3, blockingPending: 2 }, { key: own, pending: 9 }], own);
  assert.deepEqual([...known], [[peer, 2]]);
  known = mergeKnownPending(known, [], own);
  assert.equal(known.get(peer), 2);
  known = mergeKnownPending(known, [{ key: "referee:another-device", pending: 0, blockingPending: 0 }], own);
  assert.equal(known.get(peer), 2);
  known = mergeKnownPending(known, [{ key: peer }], own);
  assert.equal(known.get(peer), 2);
  // Same peer reconnects with only its finalization left: this is an explicit drain.
  known = mergeKnownPending(known, [{ key: peer, pending: 1, blockingPending: 0 }], own);
  assert.equal(known.size, 0);
  known = mergeKnownPending(known, [], own);
  assert.equal(known.size, 0);
});

test("legacy peer counts remain conservative and duplicate presence rows cannot clear a known queue", () => {
  const own = "admin:a";
  const peer = "referee:b";
  let known = mergeKnownPending(new Map(), [{ key: peer, pending: 2 }], own);
  assert.equal(known.get(peer), 2);
  known = mergeKnownPending(known, [{ key: peer, blockingPending: 0 }, { key: peer, blockingPending: 1 }], own);
  assert.equal(known.get(peer), 1);
  known = mergeKnownPending(known, [{ key: peer, blockingPending: -1 }], own);
  assert.equal(known.get(peer), 1);
  known = mergeKnownPending(known, [{ key: peer, pending: 0 }], own);
  assert.equal(known.size, 0);
});
