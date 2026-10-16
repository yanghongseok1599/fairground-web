import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextRequestGuard } from '../scripts/testing/browser/context-request-guard.mjs';

async function fixture({ bind = true } = {}) {
  let handler;
  const page = {};
  const receipt = {};
  const context = {
    route: async (pattern, callback) => { assert.equal(pattern, '**/*'); handler = callback; },
    unroute: () => assert.fail('Never unroute a live context'),
  };
  const guard = createContextRequestGuard(context, { receipt });
  await guard.start();
  if (bind) guard.bindOwnedPage(page);
  const calls = [];
  const request = (owner = page) => ({ serviceWorker: () => null, frame: () => ({ page: () => owner }) });
  const route = (input = request()) => ({
    request: () => input,
    abort: async (reason) => calls.push(['abort', reason]),
    continue: async () => calls.push(['continue']),
  });
  return { guard, receipt, page, calls, request, route, handle: (...args) => handler(...args) };
}

test('only the exact bound Page can continue and routing stays installed through cleanup', async () => {
  const f = await fixture();
  await f.handle(f.route());
  await f.guard.assertHealthy();
  assert.deepEqual(f.calls, [['continue']]);
  assert.throws(() => f.guard.bindOwnedPage(f.page), /rebound/);
  await assert.rejects(f.guard.dispose({ contextClosed: false }), /must remain/);
  f.guard.beginClose();
  await f.handle(f.route());
  await f.guard.dispose({ contextClosed: true });
  assert.deepEqual(f.calls, [['continue'], ['abort', 'blockedbyclient']]);
  assert.equal(f.receipt.contextRequestGuard.closed, true);
});

for (const [name, input] of [
  ['foreign Page', () => ({ serviceWorker: () => null, frame: () => ({ page: () => ({}) }) })],
  ['initial popup without frame', () => ({ serviceWorker: () => null, frame: () => { throw new Error('secret request URL'); } })],
  ['service worker', () => ({ serviceWorker: () => ({}), frame: () => assert.fail('Worker must not be assigned a Page') })],
  ['missing ownership API', () => ({})],
]) {
  test(`${name} is aborted and fails without needing a Page event`, async () => {
    const f = await fixture();
    await f.handle(f.route(input()));
    await assert.rejects(f.guard.failed, /Context request guard failed/);
    await assert.rejects(f.guard.assertHealthy(), /Context request guard failed/);
    assert.deepEqual(f.calls, [['abort', 'blockedbyclient']]);
    assert.equal(f.receipt.contextRequestGuard.blockedRequests, 1);
    assert.ok(!JSON.stringify(f.receipt).includes('secret'));
    f.guard.beginClose();
    await f.guard.dispose({ contextClosed: true });
  });
}

test('requests before the owned Page is bound are never released', async () => {
  const f = await fixture({ bind: false });
  await f.handle(f.route());
  await assert.rejects(f.guard.assertHealthy(), /unowned-page/);
  assert.deepEqual(f.calls, [['abort', 'blockedbyclient']]);
});

test('the abort settles before the failure wakes cleanup', async () => {
  const f = await fixture();
  let release;
  let notified = false;
  f.guard.failed.catch(() => { notified = true; });
  const route = f.route(f.request({}));
  route.abort = () => new Promise((resolve) => { release = resolve; });
  const work = f.handle(route);
  await new Promise(setImmediate);
  assert.equal(notified, false);
  release();
  await work;
  await assert.rejects(f.guard.failed, /unowned-page/);
});

for (const operation of ['abort', 'continue']) {
  test(`${operation} failure is fixed-label evidence and cannot pass`, async () => {
    const f = await fixture();
    const route = f.route(f.request(operation === 'abort' ? {} : f.page));
    route[operation] = async () => { throw new Error('Authorization: secret?token=private'); };
    await f.handle(route);
    await assert.rejects(f.guard.assertHealthy(), new RegExp(`${operation}-failed`));
    assert.ok(!JSON.stringify(f.receipt).includes('secret'));
  });
}

test('an unresponsive abort is bounded and remains a failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture();
  const route = f.route(f.request({}));
  route.abort = () => new Promise(() => {});
  const work = f.handle(route);
  await Promise.resolve();
  t.mock.timers.tick(5000);
  await work;
  await assert.rejects(f.guard.failed, /abort-failed/);
});
