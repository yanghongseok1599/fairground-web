import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { benchRoster } = load('src/features/match-control/bench-roster.ts');
const { createPracticeStore } = load('src/features/match-simulation/store.ts');
for (const teamId of ['practice-blue', 'practice-red']) {
  test(`${teamId}: 명단 미제출이어도 코트 밖 선수들을 대기로 표시한다`, () => {
    const { players } = createPracticeStore().getState().snapshot;
    const pool = players.filter(p => p.teamId === teamId);
    const bench = benchRoster([], pool, pool.slice(0, 5));
    assert.deepEqual(bench.map(p => p.id), pool.slice(5).map(p => p.id));
  });
}
test('일부 제출 명단이 있어도 나머지 팀 선수를 유지하고 선출과 코트 선수만 제외한다', () => {
  const { players } = createPracticeStore().getState().snapshot;
  const pool = players.filter(p => p.teamId === 'practice-blue');
  const entries = [{ playerId: pool[5].id, isStarter: false }];
  assert.equal(benchRoster(entries, pool, pool.slice(0, 5)).length, 2);
  assert.deepEqual(benchRoster(entries, pool.map(p => ({ ...p, hasPlayerExperience: p.id === pool[6].id })), pool.slice(0, 5)).map(p => p.id), [pool[5].id]);
});
