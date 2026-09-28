import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const {removePracticeRecords} = moduleLoader()('src/features/match-simulation/retirement.ts');
test('연습 기록만 제거하고 로그인·실제 기록·전송 대기열을 보존한다', () => {
  const entries = new Map([
    ['fairground:practice-match:v1', 'solo'], ['fairground:shared-practice:v1:room-a', 'shared'],
    ['fairground:shared-practice:v1:room-b', 'shared'], ['sb-auth-token', 'auth'],
    ['fg-recording-v1', 'unconfirmed'], ['fg_live', 'regular'], ['fg_players', 'players'],
  ]);
  const storage = { get length(){return entries.size;}, key: i=>[...entries.keys()][i], removeItem: key=>entries.delete(key) };
  assert.equal(removePracticeRecords(storage),3);
  assert.deepEqual([...entries.keys()],['sb-auth-token','fg-recording-v1','fg_live','fg_players']);
  assert.equal(removePracticeRecords(storage),0);
});
