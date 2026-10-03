import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureStatusText, startCupFixtureRefresh, updateCupFixtureRows } from '../public/cup-ops/live-fixtures.js';

const fixtures = () => Array.from({ length: 8 }, (_, index) => ({
  slot: index + 13, home: '합성 홈팀', away: '합성 원정팀',
  homeLabel: 'A조 4위 · 합성 홈팀', awayLabel: 'B조 4위 · 합성 원정팀',
  homeTeamId: 'synthetic-home', awayTeamId: 'synthetic-away', status: 'scheduled',
}));
const settle = () => new Promise(resolve => setImmediate(resolve));

function guideFixture(replies) {
  const rows = new Map();
  const listeners = new Map();
  const timers = new Map();
  const requests = [];
  let timerId = 0;
  for (let slot = 13; slot <= 20; slot++) {
    const cells = new Map(['match', 'status', 'rest'].map(name => [`[data-fixture-${name}]`, { textContent: '기존 표시' }]));
    rows.set(slot, { cells, querySelector: selector => cells.get(selector) });
  }
  const document = {
    hidden: false,
    scrollingElement: { scrollTop: 1234 },
    querySelector(selector) { return rows.get(Number(selector.match(/\d+/)[0])); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const stop = startCupFixtureRefresh({
    document,
    teamNames: ['합성 홈팀', '합성 원정팀', '쉬는 합성팀'],
    async fetch(url, options) {
      requests.push({ url, options });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      return { ok: true, json: async () => reply };
    },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  return { rows, document, listeners, timers, requests, stop };
}

test('final pairings keep group-rank prefixes and update only existing table cells', () => {
  const rows = new Map();
  const cells = new Map(['match', 'status', 'rest'].map(name => [`[data-fixture-${name}]`, { textContent: '기존 표시' }]));
  const row = { querySelector: selector => cells.get(selector) };
  rows.set(17, row);
  const document = { scrollingElement: { scrollTop: 1234 }, querySelector: () => row };
  updateCupFixtureRows([fixtures()[4]], { document, teamNames: ['합성 홈팀', '합성 원정팀', '쉬는 합성팀'] });
  assert.equal(cells.get('[data-fixture-match]').textContent, 'A조 4위 · 합성 홈팀 vs B조 4위 · 합성 원정팀');
  assert.equal(cells.get('[data-fixture-rest]').textContent, '쉬는 합성팀');
  assert.equal(document.scrollingElement.scrollTop, 1234);
  assert.equal(rows.get(17), row);
});

test('regular and shootout scores remain separate in the match status', () => {
  assert.equal(fixtureStatusText({ status: 'finished', homeScore: 0, awayScore: 0, homeShootoutScore: 0, awayShootoutScore: 1 }), '종료 · 0 : 0 · PK 0 : 1');
  assert.equal(fixtureStatusText({ status: 'live', homeScore: 0, awayScore: 2 }), '진행 중 · 0 : 2');
  assert.equal(fixtureStatusText({}), '결과 대기');
});

test('the guide refreshes after five seconds and preserves confirmed pairings after a network failure', async () => {
  const f = guideFixture([{ fixtures: fixtures() }, new Error('offline')]);
  await settle();
  const matchCell = f.rows.get(17).cells.get('[data-fixture-match]');
  const confirmed = matchCell.textContent;
  assert.equal(f.requests[0].url, '/api/cup-fixtures');
  assert.equal(f.requests[0].options.cache, 'no-store');
  assert.equal([...f.timers.values()][0].delay, 5000);
  await [...f.timers.values()][0].callback();
  assert.equal(matchCell.textContent, confirmed);
  assert.equal(f.document.scrollingElement.scrollTop, 1234);
  assert.equal(f.requests.length, 2);
  f.stop();
  assert.equal(f.timers.size, 0);
});

test('hidden pages stop polling and refresh immediately on return', async () => {
  const f = guideFixture([{ fixtures: fixtures() }, { fixtures: fixtures() }]);
  await settle();
  f.document.hidden = true;
  f.listeners.get('visibilitychange')();
  assert.equal(f.timers.size, 0);
  assert.equal(f.requests.length, 1);
  f.document.hidden = false;
  f.listeners.get('visibilitychange')();
  await settle();
  assert.equal(f.requests.length, 2);
  f.stop();
  assert.equal(f.listeners.size, 0);
});

test('incomplete responses never overwrite the confirmed table', async () => {
  const f = guideFixture([{ fixtures: fixtures().slice(0, 3) }]);
  await settle();
  assert.equal(f.rows.get(17).cells.get('[data-fixture-match]').textContent, '기존 표시');
  f.stop();
});
