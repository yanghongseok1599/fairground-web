import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";
const load = moduleLoader();
const { createPracticeStore } = load("src/features/match-simulation/store.ts");
const { applyRecordingCommand } = load("src/features/match-simulation/shared/recording-commands.ts");
const { rosterPlayers, rosterStats } = load("src/features/match-control/roster-stats.ts");

test("전체 명단은 선발과 벤치를 합쳐 등번호순으로 표시하고 다른 팀과 부적격 선수를 제외한다", () => {
  const s = createPracticeStore().getState().snapshot;
  const list = rosterPlayers([...s.players, { ...s.players[0], id: "excluded", hasPlayerExperience: true }], s.match.homeTeamId);
  assert.deepEqual(list.map(p => p.number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(s.lineup.find(p => p.playerId === list[6].id).isStarter, false);
});

test("벤치로 등록된 선수도 교체 조작 없이 기록하고 골·어시·카드와 취소를 집계한다", async () => {
  const store = createPracticeStore(), m = store.getState().snapshot.match;
  await store.getState().startMatch(m.tournamentId, m.id);
  const record = event => applyRecordingCommand(store.getState(), m.id, { action: "record", event, playerId: "practice-blue-6" });
  await record("goal"); await record("assist"); await record("yellow_card"); await record("yellow_card");
  assert.deepEqual(rosterStats(store.getState().snapshot.match.events).get("practice-blue-6"), { goal: 1, assist: 1, yellow_card: 2, red_card: 1 });
  const yellow = store.getState().snapshot.match.events.find(e => e.type === "yellow_card");
  await applyRecordingCommand(store.getState(), m.id, { action: "cancel", eventId: yellow.id });
  assert.deepEqual(rosterStats(store.getState().snapshot.match.events).get("practice-blue-6"), { goal: 1, assist: 1, yellow_card: 1 });
});

test("운영자가 보낸 팀·선수명·시간은 사용하지 않고 현재 경기와 가상 명단으로 검증한다", async () => {
  const store = createPracticeStore(), m = store.getState().snapshot.match;
  await store.getState().startMatch(m.tournamentId, m.id);
  await store.getState().updateMatchTimer(m.id, 180, 1);
  await applyRecordingCommand(store.getState(), m.id, { action: "record", event: "goal", playerId: "practice-red-7", teamId: "practice-blue", playerName: "wrong", minute: 99 });
  const e = store.getState().snapshot.match.events[0];
  assert.equal(e.teamId, "practice-red"); assert.equal(e.playerName, "레드 7번"); assert.equal(e.minute, 3);
  for (const c of [null, { action: "record", event: "mom", playerId: "practice-red-7" }, { action: "record", event: "goal", playerId: "production-player" }]) await assert.rejects(applyRecordingCommand(store.getState(), m.id, c));
  await assert.rejects(applyRecordingCommand(store.getState(), "old-match", { action: "cancel", eventId: e.id }));
  assert.equal(store.getState().snapshot.match.events.length, 1);
});
