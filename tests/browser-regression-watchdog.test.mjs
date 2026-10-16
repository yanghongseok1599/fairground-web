import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { armBrowserWatchdog } from '../scripts/testing/browser/watchdog.mjs';

function fixture(t, engine = 'chromium', options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const child = new EventEmitter();
  const signals = [];
  const events = [];
  child.kill = (signal) => { signals.push(signal); return true; };
  const cancel = armBrowserWatchdog(child, {
    engine,
    onTimeout: () => events.push('timeout'),
    onForceTermination: (receipt) => events.push(receipt),
    ...options,
  });
  return { child, signals, events, cancel };
}

test('normal completion cancels the watchdog and removes its listeners', (t) => {
  const f = fixture(t);
  f.child.emit('close', 0, null);
  f.cancel();
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, []);
  assert.deepEqual(f.events, []);
  assert.equal(f.child.listenerCount('close'), 0);
  assert.equal(f.child.listenerCount('error'), 0);
});

test('explicit cancellation is idempotent and preserves unrelated listeners', (t) => {
  const f = fixture(t);
  const otherListener = () => {};
  f.child.on('close', otherListener);
  f.cancel();
  f.cancel();
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, []);
  assert.deepEqual(f.child.listeners('close'), [otherListener]);
});

test('deadline sends one SIGTERM then Chromium has a full 30-second cleanup grace', (t) => {
  const f = fixture(t);
  t.mock.timers.tick(179_999);
  assert.deepEqual(f.signals, []);
  t.mock.timers.tick(1);
  assert.deepEqual(f.signals, ['SIGTERM']);
  assert.deepEqual(f.events, ['timeout']);
  t.mock.timers.tick(29_999);
  assert.deepEqual(f.signals, ['SIGTERM']);
  t.mock.timers.tick(1);
  assert.deepEqual(f.signals, ['SIGTERM', 'SIGKILL']);
  assert.deepEqual(f.events, ['timeout', {
    signal: 'SIGKILL', signalSent: true, cleanupConfirmed: false,
  }]);
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, ['SIGTERM', 'SIGKILL']);
});

test('Ego times out once and never escalates to SIGKILL', (t) => {
  const f = fixture(t, 'ego', { timeoutMs: 500 });
  t.mock.timers.tick(500);
  assert.deepEqual(f.signals, ['SIGTERM']);
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, ['SIGTERM']);
  assert.deepEqual(f.events, ['timeout']);
  f.cancel();
});

test('a late close during Chromium cleanup prevents force termination', (t) => {
  const f = fixture(t);
  t.mock.timers.tick(180_000);
  t.mock.timers.tick(29_999);
  f.child.emit('close', 1, null);
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, ['SIGTERM']);
  assert.deepEqual(f.events, ['timeout']);
});

test('explicit cancellation after timeout also cancels escalation', (t) => {
  const f = fixture(t);
  t.mock.timers.tick(180_000);
  f.cancel();
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, ['SIGTERM']);
  assert.deepEqual(f.events, ['timeout']);
});

test('a failed child launch cancels both watchdog timers', (t) => {
  const f = fixture(t);
  f.child.emit('error', new Error('spawn failed'));
  t.mock.timers.tick(1_000_000);
  assert.deepEqual(f.signals, []);
  assert.deepEqual(f.events, []);
});

test('force-termination receipt distinguishes an unsent signal and never confirms cleanup', (t) => {
  const f = fixture(t);
  t.mock.timers.tick(180_000);
  f.child.kill = (signal) => { f.signals.push(signal); return false; };
  t.mock.timers.tick(30_000);
  assert.deepEqual(f.events[1], { signal: 'SIGKILL', signalSent: false, cleanupConfirmed: false });
});

test('rejects unknown engines and timer overflow before attaching listeners', () => {
  const child = new EventEmitter();
  assert.throws(() => armBrowserWatchdog(child, { engine: 'other' }), /Unknown browser/);
  for (const timeoutMs of [0, -1, NaN, 0.5, Infinity, 2_147_483_648]) {
    assert.throws(() => armBrowserWatchdog(child, { engine: 'chromium', timeoutMs }), /positive timer/);
  }
  assert.deepEqual(child.eventNames(), []);
});
