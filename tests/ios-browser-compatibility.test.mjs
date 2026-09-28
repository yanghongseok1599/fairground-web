import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function installGlobals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key]);
  }
}

test('iPhone uses the active service worker without invoking the unsupported constructor', async (t) => {
  const calls = [];
  class Notification { static permission = 'granted'; constructor() { throw new TypeError('Illegal constructor'); } }
  installGlobals(t, { window: { Notification }, Notification,
    navigator: { serviceWorker: { getRegistration: async () => ({ active: {}, showNotification: async (...args) => calls.push(args) }) } },
  });
  const { showDeviceNotification } = moduleLoader()('src/lib/notifications/show-device-notification.ts');
  assert.equal(await showDeviceNotification('경기 시작 안내'), true);
  assert.equal(calls[0][0], '경기 시작 안내');
  assert.equal(calls[0][1].data.url, '/my');
});

test('unsupported, blocked and throwing mobile APIs do not interrupt the page', async (t) => {
  class Notification { static permission = 'denied'; constructor() { throw new TypeError('Illegal constructor'); } }
  installGlobals(t, { window: { Notification }, Notification, navigator: {} });
  const { showDeviceNotification } = moduleLoader()('src/lib/notifications/show-device-notification.ts');
  assert.equal(await showDeviceNotification('test'), false);
  Notification.permission = 'granted';
  assert.equal(await showDeviceNotification('test'), false);
  navigator.serviceWorker = { getRegistration: async () => { throw new Error('SecurityError'); } };
  assert.equal(await showDeviceNotification('test'), false);
  delete window.Notification;
  assert.equal(await showDeviceNotification('test'), false);
});

test('Safari storage getter, quota and read failures cannot crash or prevent closing the install prompt', () => {
  const path = 'src/components/pwa-install-prompt.tsx';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && ['readDismissedAt', 'markDismissed'].includes(n.name?.text));
  const code = ts.transpileModule(functions.map(n => n.getText(source)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const window of [
    { get localStorage() { throw new Error('SecurityError'); } },
    { localStorage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } } },
  ]) {
    const { readDismissedAt, markDismissed } = new Function('window', 'DISMISS_KEY', code + '; return { readDismissedAt, markDismissed };')(window, 'test');
    assert.equal(readDismissedAt(), 0);
    assert.doesNotThrow(markDismissed);
  }
});

test('the home promotion can open and dismiss even when Safari blocks storage getters', () => {
  const path = 'src/components/home-promotion-popup.tsx';
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['browserStorage', 'readStorage', 'writeStorage', 'readDailyDismissed', 'writeDailyDismissed', 'todayStamp'];
  const functions = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  const code = ts.transpileModule(functions.map(n => n.getText(source)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const window = new Proxy({}, { get() { throw new Error('SecurityError'); } });
  const f = new Function('window', code + `; return {${names.join(',')}};`)(window);
  for (const kind of ['localStorage', 'sessionStorage']) {
    assert.equal(f.readStorage(f.browserStorage(kind), 'test'), false);
    assert.equal(f.readDailyDismissed(f.browserStorage(kind), 'test'), false);
    assert.doesNotThrow(() => f.writeStorage(f.browserStorage(kind), 'test'));
    assert.doesNotThrow(() => f.writeDailyDismissed(f.browserStorage(kind), 'test'));
  }
});
