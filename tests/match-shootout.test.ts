import assert from "node:assert/strict";
import test from "node:test";
import { hasShootoutResult, requiresShootout, shootoutScoreError, shootoutWinner, shootoutResultText } from "../src/features/match-shootout/model.ts";
import { projectRoom, reconcileSnapshot, type RecordingRoom } from "../src/features/match-recording/model.ts";
import { flushRoom } from "../src/features/match-recording/sync-core.ts";

const match = { homeScore: 1, awayScore: 1, homeTeamName: "홈", awayTeamName: "원정", homeShootoutScore: 3, awayShootoutScore: 2 };
const room = (): RecordingRoom => ({ key: "actor:match", actorId: "actor", matchId: "match", revision: 1, savedAt: 0, players: [], lineups: [], journal: [], pending: [], base: {
  ...match, homeShootoutScore: undefined, awayShootoutScore: undefined, id: "match", tournamentId: "tournament", round: 13,
  homeTeamId: "home", awayTeamId: "away", status: "live", scheduledAt: 0, events: [], elapsedSeconds: 720, currentHalf: 1, isRunning: false, serverRevision: 1,
} });

test("only complete unequal nonnegative integer totals resolve a tied regular score", () => {
  assert.equal(shootoutWinner(match), "home");
  assert.equal(shootoutWinner({ ...match, homeShootoutScore: 2, awayShootoutScore: 3 }), "away");
  for (const scores of [[undefined, undefined], [3, undefined], [2, 2], [-1, 0], [2.5, 1], [100, 1], [NaN, 0]]) {
    assert.equal(hasShootoutResult({ ...match, homeShootoutScore: scores[0], awayShootoutScore: scores[1] }), false);
  }
  assert.equal(shootoutWinner({ ...match, homeScore: 2 }), undefined);
  assert.equal(shootoutResultText(match), "승부차기 3 : 2 · 홈 승");
  assert.equal(shootoutScoreError(0, 1), undefined);
  assert.equal(requiresShootout({ ...match, round: 13 }), true);
  assert.equal(requiresShootout({ ...match, round: 13, groupId: "A" }), false);
  assert.equal(requiresShootout({ ...match, round: 12 }), false);
});

test("durable shootout projection and refresh keep regular scores and events untouched", () => {
  const r = room();
  r.pending = [{ id: "shootout", kind: "shootout", at: 100, payload: { homeScore: 0, awayScore: 1, _shootoutHomeBefore: -1, _shootoutAwayBefore: -1 } }];
  r.journal = structuredClone(r.pending);
  const projected = projectRoom(JSON.parse(JSON.stringify(r)));
  assert.equal(projected.homeScore, 1); assert.equal(projected.awayScore, 1);
  assert.deepEqual(projected.events, []);
  assert.equal(shootoutWinner(projected), "away");
  assert.equal(r.base.homeShootoutScore, undefined);
  const merged = reconcileSnapshot(r, { ...projected, serverRevision: 2, appliedOperationIds: ["shootout"] });
  assert.equal(merged.pending.length, 0); assert.equal(merged.journal.length, 1);
  assert.equal(shootoutWinner(merged.base), "away");
});

test("response loss retries the same shootout UUID before ending, without changing goal totals", async () => {
  let r = room();
  r.pending = [{ id: "shootout", kind: "shootout", at: 100, payload: { homeScore: 3, awayScore: 2 } }, { id: "end", kind: "end", at: 101, payload: {} }];
  r.journal = structuredClone(r.pending);
  const sent: string[] = []; let lost = true;
  const deps = { currentActor: () => "actor", update: async (_key: string, change: (current?: RecordingRoom) => RecordingRoom) => r = change(r), send: async (_id: string, command: RecordingRoom["pending"][number]) => {
    sent.push(command.id);
    if (lost) { lost = false; throw new Error("response lost"); }
    return { ...projectRoom({ ...r, pending: [command] }), serverRevision: (r.base.serverRevision ?? 0) + 1, appliedOperationIds: [...(r.base.appliedOperationIds ?? []), command.id] };
  } };
  await flushRoom(r, deps); assert.equal(r.pending.length, 2);
  await flushRoom(JSON.parse(JSON.stringify(r)), deps);
  assert.deepEqual(sent, ["shootout", "shootout", "end"]);
  assert.equal(r.base.status, "finished"); assert.equal(r.base.homeScore, 1); assert.equal(r.base.awayScore, 1);
  assert.equal(shootoutWinner(r.base), "home"); assert.deepEqual(r.base.events, []);
});

test("another operator's result conflict retains both shootout and queued end for review", async () => {
  let r = room();
  r.pending = [{ id: "shootout", kind: "shootout", at: 100, payload: { homeScore: 3, awayScore: 2 } }, { id: "end", kind: "end", at: 101, payload: {} }];
  r.journal = structuredClone(r.pending);
  await flushRoom(r, { currentActor: () => "actor", update: async (_key, change) => r = change(r), send: async () => { throw { code: "22023", message: "shootout result changed; review pending result" }; } });
  assert.equal(r.blocked, true); assert.deepEqual(r.pending.map(c => c.id), ["shootout", "end"]);
  assert.equal(r.base.status, "live"); assert.equal(r.journal.length, 2);
});
