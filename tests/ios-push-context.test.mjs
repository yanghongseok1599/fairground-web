import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const chrome = safari.replace('Version/18.0', 'CriOS/140.0.7339.100');

function fixture(t, { ua = safari, standalone = false, displayMode = false, permission = 'granted', saved = false, failure = false, platform = 'iPhone', maxTouchPoints = 5 } = {}) {
  const calls = [];
  const notification = { permission, requestPermission: async () => { calls.push('permission'); return permission; } };
  const values = {
    window: { Notification: notification, PushManager: {}, matchMedia: () => ({ matches: displayMode }), dispatchEvent() {} },
    Notification: notification,
    navigator: { userAgent: ua, platform, maxTouchPoints, standalone, serviceWorker: { getRegistration: async () => { calls.push('worker'); return undefined; } } },
  };
  for (const [name, value] of Object.entries(values)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
  }
  const load = moduleLoader({
    '@/lib/push': { hasSavedPushSubscription: async (userId) => { calls.push(userId); if (failure) throw new Error('offline'); return saved; } },
    '@/config/supabase': { supabase: { rpc: () => { throw new Error('Unexpected RPC'); } } },
  });
  return { calls, load, status: load('src/features/tournament-readiness/push-status.ts').readTournamentPushStatus };
}

for (const [browser, ua] of [['safari', safari], ['chrome', chrome]]) {
  test(`iPhone ${browser} tab cannot read the Home Screen permission or start a subscription`, async (t) => {
    const f = fixture(t, { ua });
    const result = await f.status('player');
    assert.equal(result.state, 'install');
    assert.equal(result.permission, 'unavailable');
    assert.equal(result.environment.browser, browser);
    const push = f.load('src/lib/push.ts');
    assert.equal(push.PUSH_SUPPORTED, false);
    assert.equal(await push.getPushPermission(), 'unavailable');
    assert.equal(await push.subscribeAndSave(), false);
    assert.deepEqual(f.calls, []);
  });
}

test('installed iPhone: permission granted is distinct from account delivery not connected', async (t) => {
  const f = fixture(t, { standalone: true });
  const result = await f.status('player');
  assert.equal(result.permission, 'granted');
  assert.equal(result.state, 'unlinked');
  assert.deepEqual(f.calls, ['player']);
});

test('installed iPhone with a saved current-account subscription is ON', async (t) => {
  const f = fixture(t, { displayMode: true, saved: true });
  assert.equal((await f.status('player')).state, 'on');
});

test('a server status error preserves granted permission without claiming OFF or denied', async (t) => {
  const f = fixture(t, { standalone: true, failure: true });
  const result = await f.status('player');
  assert.equal(result.state, 'error');
  assert.equal(result.permission, 'granted');
});

test('returning from iOS settings reads the new permission, not a cached value', async (t) => {
  const f = fixture(t, { standalone: true, permission: 'denied', saved: true });
  assert.equal((await f.status('player')).state, 'denied');
  Notification.permission = 'granted';
  assert.equal((await f.status('player')).state, 'on');
  Notification.permission = 'denied';
  assert.equal((await f.status('player')).state, 'denied');
  assert.deepEqual(f.calls, ['player']);
});

test('iPad desktop user agent still requires the Home Screen app', async (t) => {
  const f = fixture(t, { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Version/18.0 Safari/605.1.15', platform: 'MacIntel' });
  assert.equal((await f.status('player')).state, 'install');
});

test('Android Chrome can enable push without iOS installation guidance', async (t) => {
  const f = fixture(t, { ua: 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36', platform: 'Linux', permission: 'default' });
  const result = await f.status('player');
  assert.equal(result.environment.ios, false);
  assert.equal(result.state, 'off');
  assert.equal(result.permission, 'default');
});

test('in-app iPhone browsers are not mistaken for Safari or Chrome', async (t) => {
  const f = fixture(t, { ua: safari + ' KAKAOTALK' });
  const result = await f.status('player');
  assert.equal(result.environment.browser, 'in-app');
  assert.equal(result.state, 'install');
});

test('no browser globals is SSR-safe', (t) => {
  fixture(t);
  delete globalThis.window;
  const { getPushEnvironment } = moduleLoader()('src/features/tournament-readiness/push-environment.ts');
  assert.equal(getPushEnvironment().supported, false);
});
