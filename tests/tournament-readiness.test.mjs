import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function fixture(t, { permission = 'granted', saved = true, readError = null, writeError = null, permissionError = false } = {}) {
  const events = [];
  const filters = [];
  let subscribed = true;
  let writes = 0;
  const subscription = {
    endpoint: 'https://push.example.test/current-device',
    getKey: () => new Uint8Array([1, 2, 3]).buffer,
    unsubscribe: async () => { subscribed = false; return true; },
  };
  const registration = { pushManager: {
    getSubscription: async () => subscribed ? subscription : null,
    subscribe: async () => { subscribed = true; return subscription; },
  } };
  const notification = { permission, requestPermission: async () => {
    if (permissionError) throw new Error('permission unavailable');
    return permission;
  } };
  const globals = {
    window: { PushManager: {}, Notification: notification, dispatchEvent: (event) => events.push(event.type) },
    navigator: { userAgent: 'test-browser', serviceWorker: { getRegistration: async () => registration, ready: Promise.resolve(registration) } },
    Notification: notification,
  };
  for (const [name, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'current-account' } }, error: null }) },
    rpc: async () => ({ data: 'AQID', error: null }),
    from: (table) => {
      assert.equal(table, 'push_subscriptions');
      const query = {
        select: () => query,
        eq: (column, value) => { filters.push([column, value]); return query; },
        maybeSingle: async () => ({ data: saved ? { endpoint: subscription.endpoint } : null, error: readError }),
        upsert: async (row) => { writes++; assert.equal(row.user_id, 'current-account'); return { error: writeError }; },
        delete: () => query,
        then: (resolve) => resolve({ error: null }),
      };
      return query;
    },
  };
  const push = moduleLoader({ '@/config/supabase': { supabase } })('src/lib/push.ts');
  return { push, filters, events, notification, subscription, get subscribed() { return subscribed; }, get writes() { return writes; } };
}

test('a browser-only subscription without a saved endpoint is not ON', async (t) => {
  const f = fixture(t, { saved: false });
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), false);
});
test('checks both the signed-in account and this device endpoint', async (t) => {
  const f = fixture(t);
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), true);
  assert.deepEqual(f.filters, [['user_id', 'current-account'], ['endpoint', f.subscription.endpoint]]);
  assert.equal(await f.push.hasSavedPushSubscription('previous-account'), false);
});
test('revoked permission never looks ON even with a saved subscription', async (t) => {
  const f = fixture(t, { permission: 'denied' });
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), false);
  assert.equal(await f.push.subscribeAndSave(), false);
  assert.equal(f.writes, 0);
});
test('network failures remain distinguishable from missing subscriptions', async (t) => {
  const f = fixture(t, { readError: new Error('network failure') });
  await assert.rejects(f.push.hasSavedPushSubscription('current-account'), /network failure/);
  assert.equal(await f.push.isCurrentlySubscribed(), false);
});
test('failed persistence clears the orphan browser subscription and broadcasts a refresh', async (t) => {
  const f = fixture(t, { writeError: { message: 'write denied' } });
  assert.equal(await f.push.subscribeAndSave(), false);
  assert.equal(f.subscribed, false);
  assert.equal(f.events.at(-1), f.push.PUSH_SUBSCRIPTION_CHANGED);
});
test('successful enable and disable refresh other readiness entry points', async (t) => {
  const f = fixture(t);
  assert.equal(await f.push.subscribeAndSave(), true);
  assert.equal(f.writes, 1);
  await f.push.unsubscribeAndDelete();
  assert.equal(f.subscribed, false);
  assert.equal(f.events.length, 2);
});
test('a throwing browser permission prompt fails without an unhandled rejection', async (t) => {
  const f = fixture(t, { permission: 'default', permissionError: true });
  assert.equal(await f.push.subscribeAndSave(), false);
  assert.equal(f.writes, 0);
});

test('a stalled worker lookup exits after ten seconds without changing subscriptions', async (t) => {
  const f = fixture(t);
  navigator.serviceWorker.getRegistration = () => new Promise(() => {});
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = assert.rejects(f.push.hasSavedPushSubscription('current-account'), /PUSH_STATUS_TIMEOUT/);
  t.mock.timers.tick(10_000);
  await result;
  assert.equal(f.writes, 0);
  assert.equal(f.subscribed, true);
});
