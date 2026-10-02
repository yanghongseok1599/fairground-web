import assert from "node:assert/strict";
import test from "node:test";
import { canReleaseRejectedEnd, releaseRejectedEnd } from "../src/features/match-recording/control-recovery.ts";
import { flushRoom } from "../src/features/match-recording/sync-core.ts";
import type { RecordingRoom, RecordingCommand } from "../src/features/match-recording/model.ts";

const command = (id: string, kind: RecordingCommand["kind"]): RecordingCommand => ({ id, kind, payload: { _clockVersion: 1 }, at: 100 });
const room = (): RecordingRoom => ({
  key: "admin:match", actorId: "admin", matchId: "match", revision: 1, savedAt: 0, players: [], lineups: [], journal: [], pending: [],
  base: { id: "match", tournamentId: "tournament", round: 1, homeTeamId: "home", awayTeamId: "away", homeTeamName: "홈", awayTeamName: "원정", homeScore: 0, awayScore: 0, status: "live", scheduledAt: 0, events: [], elapsedSeconds: 30, currentHalf: 1, isRunning: true, serverRevision: 1, clock: { version: 2, ownerId: "referee", deviceId: "referee-device", ownerName: "심판" } },
});
const blockedEnd = (): RecordingRoom => {
  const r = room();
  r.pending = [command("end", "end"), command("goal", "event"), command("mom", "mom")];
  r.journal = structuredClone(r.pending);
  r.blocked = true;
  r.error = "서버 확인이 필요한 기록";
  r.rejectedOperation = { id: "end", code: "22023", message: "clock control changed; review pending control" };
  return r;
};

test("definite stale-end conflict enables only explicit recovery and preserves all other records", async () => {
  let r = room();
  r.pending = [command("end", "end"), command("goal", "event"), command("mom", "mom")];
  r.journal = structuredClone(r.pending);
  let sends = 0;
  await flushRoom(r, {
    currentActor: () => "admin", update: async (_key, change) => r = change(r),
    send: async () => { sends++; throw { code: "22023", message: "clock control changed; review pending control" }; },
  });
  assert.equal(canReleaseRejectedEnd(r), true);
  assert.equal(r.pending.length, 3);
  const beforeJournal = structuredClone(r.journal);
  const latest = { ...r.base, serverRevision: 3, homeScore: 2, appliedOperationIds: [] };
  const recovered = releaseRejectedEnd(r, latest, "end");
  assert.deepEqual(recovered.pending.map(c => c.id), ["goal", "mom"]);
  assert.deepEqual(recovered.journal, beforeJournal);
  assert.deepEqual(recovered.reviewedOperationIds, ["end"]);
  assert.equal(recovered.base.homeScore, 2);
  assert.equal(recovered.base.status, "live");
  assert.equal(recovered.blocked, false);
  assert.equal(recovered.error, undefined);
  assert.equal(recovered.rejectedOperation, undefined);
  assert.match(recovered.notice!, /최신 상태를 확인한 뒤 경기 종료를 다시 눌러주세요/);
  assert.equal(sends, 1); // Recovery never issues a replacement end.
  assert.equal(r.pending.length, 3); // Pure recovery does not mutate the stored input.
});

test("response loss exposes no release action and leaves the end UUID queued for idempotent replay", async () => {
  let r = room();
  r.pending = [command("end", "end")];
  await flushRoom(r, { currentActor: () => "admin", update: async (_key, change) => r = change(r), send: async () => { throw new Error("response lost"); } });
  assert.equal(canReleaseRejectedEnd(r), false);
  assert.equal(r.pending[0].id, "end");
  assert.throws(() => releaseRejectedEnd(r, r.base, "end"), /해제할 수 있는/);
});

test("other SQL failures, forfeit, non-head end, and rejection for a different operation cannot be released", () => {
  const variants: RecordingRoom[] = [];
  const differentError = blockedEnd(); differentError.rejectedOperation!.message = "match already closed; review pending records"; variants.push(differentError);
  const permission = blockedEnd(); permission.rejectedOperation!.code = "42501"; variants.push(permission);
  const forfeit = blockedEnd(); forfeit.pending[0].kind = "forfeit"; variants.push(forfeit);
  const nonHead = blockedEnd(); nonHead.pending.unshift(command("first-goal", "event")); variants.push(nonHead);
  const wrongId = blockedEnd(); wrongId.rejectedOperation!.id = "another-end"; variants.push(wrongId);
  for (const r of variants) {
    assert.equal(canReleaseRejectedEnd(r), false);
    const pending = structuredClone(r.pending);
    assert.throws(() => releaseRejectedEnd(r, r.base, "end"), /해제할 수 있는/);
    assert.deepEqual(r.pending, pending);
  }
});

test("snapshot acknowledgement wins over explicit release without discarding unrelated pending records", () => {
  const r = blockedEnd();
  const recovered = releaseRejectedEnd(r, { ...r.base, serverRevision: 2, appliedOperationIds: ["end"] }, "end");
  assert.deepEqual(recovered.pending.map(c => c.id), ["goal", "mom"]);
  assert.deepEqual(recovered.journal, r.journal);
  assert.equal(recovered.reviewedOperationIds, undefined);
  assert.equal(recovered.notice, undefined);
  assert.equal(recovered.blocked, false);
});

test("stale or mismatched snapshots and a changed queue fail closed", () => {
  const r = blockedEnd();
  assert.throws(() => releaseRejectedEnd(r, { ...r.base, serverRevision: 0 }, "end"), /최신 경기 상태/);
  assert.throws(() => releaseRejectedEnd(r, { ...r.base, id: "other-match" }, "end"), /최신 경기 상태/);
  assert.throws(() => releaseRejectedEnd(r, r.base, "different-end"), /해제할 수 있는/);
  assert.deepEqual(r.pending.map(c => c.id), ["end", "goal", "mom"]);
});
