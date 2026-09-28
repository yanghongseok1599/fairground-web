import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function fixture(t, { permission = 'granted', saved = true, readError = null, writeError = null, permissionError = false, ios = false, requestedPermission = permission, conflict = false, mismatchedKeys = false } = {}) {
  const events = [];
  const filters = [];
  let subscribed = true;
  let writes = 0;
  let permissionRequests = 0;
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
    permissionRequests++;
    if (permissionError) throw new Error('permission unavailable');
    notification.permission = requestedPermission;
    return requestedPermission;
  } };
  const globals = {
    window: { PushManager: {}, Notification: notification, dispatchEvent: (event) => events.push(event.type) },
    navigator: { userAgent: ios ? 'iPhone' : 'test-browser', standalone: ios, serviceWorker: { getRegistration: async () => registration, ready: Promise.resolve(registration) } },
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
        maybeSingle: async () => ({ data: saved ? { endpoint: subscription.endpoint, p256dh: mismatchedKeys ? 'old-key' : 'AQID', auth: 'AQID' } : null, error: readError }),
        upsert: async (row, options) => {
          writes++;
          assert.equal(row.user_id, 'current-account');
          assert.deepEqual(options, { onConflict: 'endpoint', ignoreDuplicates: true });
          if (!writeError && !conflict) saved = true;
          return { error: writeError };
        },
        delete: () => query,
        then: (resolve) => resolve({ error: null }),
      };
      return query;
    },
  };
  const push = moduleLoader({ '@/config/supabase': { supabase } })('src/lib/push.ts');
  return { push, supabase, registration, filters, events, notification, subscription, get permissionRequests() { return permissionRequests; }, get subscribed() { return subscribed; }, get writes() { return writes; } };
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
test('failed persistence preserves the browser subscription for a later retry', async (t) => {
  const f = fixture(t, { writeError: { message: 'write denied' } });
  assert.equal(await f.push.subscribeAndSave(), false);
  assert.equal(f.subscribed, true);
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


test('idempotent enable works with INSERT/SELECT policies and never needs UPDATE', async (t) => {
  const f = fixture(t, { saved: false });
  assert.deepEqual(await f.push.connectPush(), { ok: true });
  assert.deepEqual(await f.push.connectPush(), { ok: true });
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), true);
});

test('an endpoint owned by another account is not rebound or falsely reported as connected', async (t) => {
  const f = fixture(t, { saved: false, conflict: true });
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'account' });
  assert.equal(f.subscribed, true);
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), false);
});

test('stale server encryption keys cannot look ON', async (t) => {
  const f = fixture(t, { mismatchedKeys: true });
  assert.equal(await f.push.hasSavedPushSubscription('current-account'), false);
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'account' });
});

test('iOS recovery asks native permission synchronously before worker or network access', async (t) => {
  const f = fixture(t, { ios: true, permission: 'denied', requestedPermission: 'granted' });
  const result = f.push.connectPush();
  assert.equal(f.permissionRequests, 1);
  assert.equal(f.writes, 0);
  assert.deepEqual(await result, { ok: true });
});

test('a true iOS denial is respected during recovery', async (t) => {
  const f = fixture(t, { ios: true, permission: 'denied' });
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'permission' });
  assert.equal(f.permissionRequests, 1);
  assert.equal(f.writes, 0);
});

test('persistence errors identify the failing stage without destroying the subscription', async (t) => {
  const f = fixture(t, { saved: false, writeError: { message: 'offline' } });
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'save' });
  assert.equal(f.subscribed, true);
});

test('provider errors are distinct from database errors', async (t) => {
  const f = fixture(t);
  f.registration.pushManager.getSubscription = async () => null;
  f.registration.pushManager.subscribe = async () => { throw new Error('APNs unavailable'); };
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'subscription' });
  assert.equal(f.writes, 0);
});

test('an account change during saving cannot report success', async (t) => {
  const f = fixture(t);
  let calls = 0;
  f.supabase.auth.getUser = async () => ({ data: { user: { id: ++calls === 1 ? 'current-account' : 'next-account' } } });
  assert.deepEqual(await f.push.connectPush(), { ok: false, reason: 'login' });
});
