import assert from "node:assert/strict";
import test from "node:test";
import { canReleaseRejectedShootout, releaseRejectedShootout } from "../src/features/match-recording/shootout-recovery.ts";
import { flushRoom } from "../src/features/match-recording/sync-core.ts";
import type { RecordingRoom, RecordingCommand } from "../src/features/match-recording/model.ts";

const command = (id: string, kind: RecordingCommand["kind"]): RecordingCommand => ({ id, kind, payload: {}, at: 100 });
const room = (): RecordingRoom => ({
  key: "admin:match", actorId: "admin", matchId: "match", revision: 1, savedAt: 0, players: [], lineups: [], journal: [], pending: [],
  base: { id: "match", tournamentId: "tournament", round: 13, homeTeamId: "home", awayTeamId: "away", homeTeamName: "홈", awayTeamName: "원정", homeScore: 1, awayScore: 1, status: "live", scheduledAt: 0, events: [], elapsedSeconds: 720, currentHalf: 1, isRunning: false, serverRevision: 5, homeShootoutScore: 3, awayShootoutScore: 2 },
});
const blockedShootout = (): RecordingRoom => {
  const r = room();
  r.pending = [command("shootout", "shootout"), command("mom", "mom"), command("end", "end"), command("event", "event"), command("timer", "timer")];
  r.journal = structuredClone(r.pending);
  r.blocked = true;
  r.error = "서버 확인이 필요한 기록";
  r.rejectedOperation = { id: "shootout", code: "22023", message: "shootout result changed; review pending result" };
  return r;
};

test("explicit shootout review preserves unrelated commands and original journal and releases only rejected result and unsent end", () => {
  const original = blockedShootout();
  original.reviewedOperationIds = ["previous-reviewed"];
  const saved = structuredClone(original);
  const latest = { ...original.base, serverRevision: 7, homeShootoutScore: 4, awayShootoutScore: 3 };
  const recovered = releaseRejectedShootout(original, latest, "shootout", "admin");
  assert.deepEqual(recovered.pending.map(c => c.id), ["mom", "event", "timer"]);
  assert.deepEqual(recovered.journal, saved.journal);
  assert.deepEqual(recovered.reviewedOperationIds, ["previous-reviewed", "shootout", "end"]);
  assert.equal(recovered.base.homeShootoutScore, 4);
  assert.equal(recovered.base.status, "live");
  assert.equal(recovered.blocked, false);
  assert.equal(recovered.error, undefined);
  assert.equal(recovered.rejectedOperation, undefined);
  assert.match(recovered.notice!, /서버 결과를 확인하고 다시 기록·종료해주세요/);
  assert.deepEqual(original, saved);
});

test("FIFO rejection prevents sending end, and explicit review never lets that end automatically execute", async () => {
  let current = room();
  current.pending = [command("shootout", "shootout"), command("mom", "mom"), command("end", "end")];
  current.journal = structuredClone(current.pending);
  const sends: string[] = [];
  await flushRoom(current, {
    currentActor: () => "admin", update: async (_key, change) => current = change(current),
    send: async (_id, c) => { sends.push(c.id); throw { code: "22023", message: "shootout result changed; review pending result" }; },
  });
  assert.deepEqual(sends, ["shootout"]);
  current = releaseRejectedShootout(current, { ...current.base, serverRevision: 6 }, "shootout", "admin");
  await flushRoom(current, {
    currentActor: () => "admin", update: async (_key, change) => current = change(current),
    send: async (_id, c) => { sends.push(c.id); return { ...current.base, serverRevision: 7, appliedOperationIds: [c.id] }; },
  });
  assert.deepEqual(sends, ["shootout", "mom"]);
  assert.equal(current.base.status, "live");
  assert.deepEqual(current.journal.map(c => c.id), ["shootout", "mom", "end"]);
});

test("acknowledged shootout wins over review: following end remains queued and no operation is marked discarded", () => {
  const original = blockedShootout();
  const recovered = releaseRejectedShootout(original, { ...original.base, serverRevision: 6, appliedOperationIds: ["shootout"] }, "shootout", "admin");
  assert.deepEqual(recovered.pending.map(c => c.id), ["mom", "end", "event", "timer"]);
  assert.deepEqual(recovered.journal, original.journal);
  assert.equal(recovered.reviewedOperationIds, undefined);
  assert.equal(recovered.notice, undefined);
  assert.equal(recovered.blocked, false);
});

test("stale snapshot, wrong match or actor, and changed rejection fail closed without changing original queue", () => {
  const original = blockedShootout();
  const saved = structuredClone(original);
  assert.throws(() => releaseRejectedShootout(original, { ...original.base, serverRevision: 4 }, "shootout", "admin"), /최신 경기 상태/);
  assert.throws(() => releaseRejectedShootout(original, { ...original.base, id: "other-match" }, "shootout", "admin"), /최신 경기 상태/);
  assert.throws(() => releaseRejectedShootout(original, original.base, "shootout", "other-actor"), /기록 계정/);
  assert.throws(() => releaseRejectedShootout(original, original.base, "another-operation", "admin"), /승부차기 충돌/);
  assert.deepEqual(original, saved);
});

test("only exact definite comparison rejections enable recovery; response loss and permission failures retain UUIDs", () => {
  for (const [code, message] of [["", "response lost"], ["42501", "not allowed"], ["22023", "shootout result must determine a winner"], ["22023", "shootout result changed; review pending result other text"]]) {
    const r = blockedShootout();
    r.rejectedOperation = { id: "shootout", code, message };
    assert.equal(canReleaseRejectedShootout(r), false);
    assert.throws(() => releaseRejectedShootout(r, r.base, "shootout", "admin"), /승부차기 충돌/);
    assert.equal(r.pending[0].id, "shootout");
  }
  const legacy = blockedShootout();
  legacy.rejectedOperation!.message = "shootout previous scores required; review pending result";
  assert.equal(canReleaseRejectedShootout(legacy), true);
});

test("unproven end order and dependent additional shootout or forfeit require manual investigation and retain everything", () => {
  const missingJournal = blockedShootout(); missingJournal.journal = [];
  const earlierEnd = blockedShootout(); earlierEnd.journal.unshift(earlierEnd.journal.splice(2, 1)[0]);
  for (const r of [missingJournal, earlierEnd]) {
    const saved = structuredClone(r);
    assert.throws(() => releaseRejectedShootout(r, r.base, "shootout", "admin"), /전송 여부/);
    assert.deepEqual(r, saved);
  }
  for (const kind of ["shootout", "forfeit"] as const) {
    const r = blockedShootout(); r.pending.push(command("dependent", kind));
    const saved = structuredClone(r);
    assert.throws(() => releaseRejectedShootout(r, r.base, "shootout", "admin"), /추가 승부차기 또는 몰수패/);
    assert.deepEqual(r, saved);
  }
});
