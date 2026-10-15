import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { classifyDestination, createNetworkGuard } from '../scripts/testing/browser/network.mjs';

const previewOrigin = 'https://fairground-7idyy4r9g-milestones-projects-d52c4dda.vercel.app';
const devOrigin = 'https://fhytkbjadhnmozppolrv.supabase.co';
const fontRoot = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/';
const toolbar = 'https://vercel.live/_next-live/feedback/feedback.js';

function fixture(send) {
  const protocol = new EventEmitter();
  const calls = [];
  protocol.send = async (method, params) => { calls.push({ method, params }); return send?.(method, params) ?? {}; };
  const receipt = {};
  const guard = createNetworkGuard(protocol, { previewOrigin, receipt });
  const emit = (url, options = {}) => protocol.emit('Fetch.requestPaused', {
    requestId: options.id ?? 'request-1', resourceType: options.resourceType ?? 'Fetch',
    redirectedRequestId: options.redirectedFrom,
    request: { url, method: options.method ?? 'GET', headers: options.headers ?? {} },
  });
  return { protocol, calls, receipt, guard, emit };
}

test('network guard enables native request-stage interception before any page request', async () => {
  const f = fixture();
  await f.guard.start();
  assert.deepEqual(f.calls, [{ method: 'Fetch.enable', params: { patterns: [{ urlPattern: '*', requestStage: 'Request' }] } }]);
  assert.equal(f.receipt.networkGuard.enabled, true);
  f.emit(previewOrigin + '/teams');
  await f.guard.assertHealthy();
  assert.deepEqual(f.calls.at(-1), { method: 'Fetch.continueRequest', params: { requestId: 'request-1' } });
  f.guard.beginClose();
  await f.guard.dispose({ browserClosed: true });
  assert.equal(f.protocol.listenerCount('Fetch.requestPaused'), 0);
  assert.equal(f.receipt.networkGuard.closed, true);
  assert.ok(!f.calls.some(({ method }) => method === 'Fetch.disable'));
});

for (const hop of [1, 2]) {
  test(`production is blocked at redirect hop ${hop} before continuing its request`, async () => {
    const f = fixture();
    await f.guard.start();
    f.emit(previewOrigin + '/initial', { id: 'start' });
    await f.guard.assertHealthy();
    if (hop === 2) {
      f.emit(previewOrigin + '/middle', { id: 'middle', redirectedFrom: 'start' });
      await f.guard.assertHealthy();
    }
    f.emit('https://fairground-kor.com/api/teams?secret=must-not-record', { id: 'blocked', redirectedFrom: hop === 2 ? 'middle' : 'start' });
    await assert.rejects(f.guard.assertHealthy(), /forbidden backend/);
    assert.ok(f.calls.some(({ method, params }) => method === 'Fetch.failRequest' && params.requestId === 'blocked'));
    assert.ok(!f.calls.some(({ method, params }) => method === 'Fetch.continueRequest' && params.requestId === 'blocked'));
    assert.equal(f.receipt.networkGuard.redirectHopsChecked, hop);
    assert.deepEqual(f.receipt.forbiddenRequests, [{ host: 'fairground-kor.com', path: '/api/teams' }]);
    assert.ok(!JSON.stringify(f.receipt).includes('must-not-record'));
    f.guard.beginClose();
    await f.guard.dispose({ browserClosed: true });
  });
}

test('unknown destinations and external iframe documents are forbidden', () => {
  for (const url of [
    'https://unapproved.example/api', 'https://other-ref.supabase.co/auth/v1/token',
    'https://fairground-futsal.vercel.app/api', 'http://fhytkbjadhnmozppolrv.supabase.co/rest/v1/teams',
    'https://user:password@fhytkbjadhnmozppolrv.supabase.co/rest/v1/teams',
  ]) assert.equal(classifyDestination(url, { previewOrigin }), 'forbidden', url);
  assert.equal(classifyDestination(devOrigin + '/frame', { previewOrigin, resourceType: 'Document' }), 'forbidden');
  assert.equal(classifyDestination(previewOrigin + '/frame', { previewOrigin, resourceType: 'Document' }), 'allowed');
});

test('only the pinned Pretendard stylesheet and font filenames may use jsDelivr', () => {
  for (const suffix of ['pretendardvariable-dynamic-subset.min.css', 'woff2-dynamic-subset/PretendardVariable.subset.91.woff2']) {
    for (const root of [fontRoot, fontRoot.replace('/dist/', '/packages/pretendard/dist/')]) {
      assert.equal(classifyDestination(root + suffix, { previewOrigin }), 'allowed');
      assert.equal(classifyDestination(root + suffix, { previewOrigin, method: 'POST' }), 'forbidden');
    }
  }
  for (const url of [fontRoot + 'script.js', fontRoot.replace('v1.3.9', 'v1.3.8') + 'pretendardvariable-dynamic-subset.min.css', 'https://cdn.jsdelivr.net/npm/unapproved/index.js']) {
    assert.equal(classifyDestination(url, { previewOrigin }), 'forbidden');
  }
});

test('only the exact optional toolbar script is excluded without hiding other failures', async () => {
  const f = fixture();
  await f.guard.start();
  f.emit(toolbar, { resourceType: 'Script' });
  await f.guard.assertHealthy();
  assert.equal(f.receipt.excludedToolingRequests.length, 1);
  assert.equal(f.receipt.forbiddenRequests.length, 0);
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
  for (const options of [{ method: 'POST', resourceType: 'Script' }, { resourceType: 'Document' }, { resourceType: 'Fetch' }]) {
    assert.equal(classifyDestination(toolbar, { previewOrigin, ...options }), 'forbidden');
  }
  assert.equal(classifyDestination(toolbar + '.extra', { previewOrigin, resourceType: 'Script' }), 'forbidden');
  assert.equal(classifyDestination('https://vercel.live/api/feedback', { previewOrigin, resourceType: 'Script' }), 'forbidden');
  f.guard.beginClose();
  await f.guard.dispose({ browserClosed: true });
});

test('a supplied bypass header is removed for one hop without persisting credentials', async () => {
  const f = fixture();
  await f.guard.start();
  f.emit(devOrigin + '/rest/v1/teams', { headers: { accept: '*/*', 'X-Vercel-Protection-Bypass': 'do-not-record' } });
  await f.guard.assertHealthy();
  assert.deepEqual(f.calls.at(-1).params.headers, [{ name: 'accept', value: '*/*' }]);
  f.emit(devOrigin + '/rest/v1/teams', { id: 'next', redirectedFrom: 'request-1', headers: { Authorization: 'dev-token' } });
  await f.guard.assertHealthy();
  assert.deepEqual(f.calls.at(-1).params, { requestId: 'next' });
  assert.ok(!JSON.stringify(f.receipt).includes('do-not-record'));
  assert.ok(!JSON.stringify(f.receipt).includes('dev-token'));
  f.guard.beginClose();
  await f.guard.dispose({ browserClosed: true });
});

test('enable failure is visible and cleanup does not disable live protection', async () => {
  const f = fixture((method) => { if (method === 'Fetch.enable') throw new Error('secret API details'); });
  await assert.rejects(f.guard.start(), /Could not enable/);
  await assert.rejects(f.guard.dispose({ browserClosed: false }), /before its owned browser/);
  await f.guard.dispose({ browserClosed: true });
  assert.equal(f.protocol.listenerCount('Fetch.requestPaused'), 0);
  assert.ok(!JSON.stringify(f.receipt).includes('secret API details'));
  assert.deepEqual(f.receipt.networkGuard.errors, ['enable']);
});

test('a continue failure blocks the request and rejects incomplete verification', async () => {
  const f = fixture((method) => { if (method === 'Fetch.continueRequest') throw new Error('Bearer sensitive'); });
  await f.guard.start();
  f.emit(previewOrigin + '/teams');
  await assert.rejects(f.guard.assertHealthy(), /interception failed/);
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
  assert.ok(!JSON.stringify(f.receipt).includes('sensitive'));
  f.guard.beginClose();
  await f.guard.dispose({ browserClosed: true });
});

test('requests arriving during owned-browser cleanup are failed rather than released', async () => {
  const f = fixture();
  await f.guard.start();
  f.guard.beginClose();
  f.emit(previewOrigin + '/teams');
  await f.guard.dispose({ browserClosed: true });
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
  assert.equal(f.receipt.networkGuard.closed, true);
});
