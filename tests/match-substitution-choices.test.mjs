import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const load = moduleLoader();
const { getSubstitutionChoices } = load("src/features/match-control/substitution-choices.ts");
const { createPracticeStore } = load("src/features/match-simulation/store.ts");

function roster(store, teamId) {
  const { players, lineup } = store.getState().snapshot;
  const courtIds = new Set(lineup.filter((p) => p.teamId === teamId && p.isStarter).map((p) => p.playerId));
  return {
    onCourt: players.filter((p) => p.teamId === teamId && courtIds.has(p.id)),
    bench: players.filter((p) => p.teamId === teamId && !courtIds.has(p.id)),
  };
}

for (const teamId of ["practice-blue", "practice-red"]) {
  for (const fromBench of [true, false]) {
    test(`${teamId}: ${fromBench ? "벤치에서 필드" : "필드에서 벤치"} 선택 시 후보와 OUT/IN 기록이 맞는다`, async () => {
      const store = createPracticeStore();
      const match = store.getState().snapshot.match;
      await store.getState().startMatch(match.tournamentId, match.id);
      const selectedId = `${teamId}-${fromBench ? 6 : 2}`;
      const selection = getSubstitutionChoices(roster(store, teamId), selectedId);
      assert.equal(selection.fromBench, fromBench);
      assert.deepEqual(selection.choices.map((p) => p.counterpart.id),
        (fromBench ? [1, 2, 3, 4, 5] : [6, 7]).map((number) => `${teamId}-${number}`));

      const { outPlayer, inPlayer } = selection.choices.find((p) => p.counterpart.number === (fromBench ? 2 : 6));
      assert.equal(outPlayer.id, `${teamId}-2`);
      assert.equal(inPlayer.id, `${teamId}-6`);
      await store.getState().substitutePlayer(match.id, teamId, outPlayer.id, inPlayer.id, inPlayer.name, 1, 1);

      const updated = roster(store, teamId);
      assert.equal(updated.onCourt.length, 5);
      assert.equal(updated.bench.length, 2);
      assert.ok(updated.onCourt.some((p) => p.id === `${teamId}-6`));
      assert.ok(updated.bench.some((p) => p.id === `${teamId}-2`));
      const event = store.getState().snapshot.match.events.at(-1);
      assert.equal(event.type, "substitution");
      assert.equal(event.playerId, `${teamId}-6`);
      assert.equal(event.playerName, inPlayer.name);
      assert.equal(event.teamId, teamId);
    });
  }
}

test("교체 후 같은 선수를 다시 누르면 현재 필드 위치에 맞춰 벤치 후보를 보여준다", async () => {
  const store = createPracticeStore();
  const match = store.getState().snapshot.match;
  await store.getState().startMatch(match.tournamentId, match.id);
  await store.getState().substitutePlayer(match.id, "practice-blue", "practice-blue-2", "practice-blue-6", "블루 6번", 1, 1);
  const selection = getSubstitutionChoices(roster(store, "practice-blue"), "practice-blue-6");
  assert.equal(selection.fromBench, false);
  assert.deepEqual(selection.choices.map((p) => p.counterpart.id), ["practice-blue-2", "practice-blue-7"]);
});

test("다른 팀이나 명단에 없는 선수를 선택하면 교체 목록을 만들지 않는다", () => {
  const team = roster(createPracticeStore(), "practice-blue");
  assert.equal(getSubstitutionChoices(team, "practice-red-6"), null);
  assert.equal(getSubstitutionChoices(team, "missing-player"), null);
});

test("반대편에 선수가 없으면 교체 후보가 비어 있다", () => {
  const team = roster(createPracticeStore(), "practice-blue");
  assert.deepEqual(getSubstitutionChoices({ ...team, bench: [] }, "practice-blue-1").choices, []);
  assert.deepEqual(getSubstitutionChoices({ ...team, onCourt: [] }, "practice-blue-6").choices, []);
});
