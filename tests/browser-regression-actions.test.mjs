import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { clickButton, inspectButton } from '../scripts/testing/browser/actions.mjs';

const name = '팀 정보 수정';
const clipped = (changes = {}) => ({
  count: 1, disabled: false, receivesInput: false,
  rect: { x: 300, y: -30, width: 180, height: 44 },
  x: 390, y: -8, width: 1512, height: 862, scrollY: 744,
  headerBottom: 60, interceptedByKnownHeader: false, interceptedBy: null,
  ...changes,
});
const exposed = (y = 160) => ({
  ...clipped(), rect: { x: 300, y, width: 180, height: 44 },
  y: y + 22, scrollY: 554, receivesInput: true, interceptedBy: 'BUTTON',
});
const resolutionError = () => Object.assign(new Error(
  `page.click timed out after 3000ms: Locator matched 1 elements, but none can receive input; <header> intercepts pointer events`,
), { name: 'ElementResolutionError' });

function browser({ observations = [], errors = [resolutionError()] } = {}) {
  const calls = [];
  const page = {
    async click(selector, options) {
      calls.push({ type: 'click', selector, options });
      const error = errors.shift();
      if (error) throw error;
    },
    async evaluate(fn, argument) {
      assert.equal(fn, inspectButton);
      assert.equal(argument, name);
      calls.push({ type: 'observe' });
      assert.ok(observations.length, 'unexpected extra observation');
      return observations.shift();
    },
    async snapshot() { calls.push({ type: 'snapshot' }); },
    async waitForTimeout(duration) { calls.push({ type: 'wait', duration }); },
    mouse: {
      async move(x, y) { calls.push({ type: 'move', x, y }); },
      async wheel(x, y) { calls.push({ type: 'wheel', x, y }); },
    },
  };
  return { page, calls };
}

function inspectFixture({ position = 'sticky', branded = true, top = 0, bottom = 60, duplicate = false } = {}) {
  const button = {
    getAttribute: () => name,
    getBoundingClientRect: () => clipped().rect,
    matches: () => false,
    contains: () => false,
  };
  const header = {
    querySelector: () => branded ? {} : null,
    getBoundingClientRect: () => ({ top, bottom }),
    contains: () => false,
  };
  return vm.runInNewContext(`(${inspectButton.toString()})(${JSON.stringify(name)})`, {
    document: {
      querySelectorAll: (selector) => selector === 'button' ? [button] : duplicate ? [header, header] : [header],
      elementFromPoint: (x, y) => { assert.equal(x, 390); assert.equal(y, -8); return null; },
    },
    getComputedStyle: () => ({ position }),
    innerWidth: 1512, innerHeight: 862, scrollY: 744,
  });
}

test('observes the branded top header even when a clipped button center has no hit target', () => {
  const state = inspectFixture();
  assert.equal(state.headerBottom, 60);
  assert.equal(state.y, -8);
  assert.equal(state.interceptedBy, null);
  assert.equal(state.interceptedByKnownHeader, false);
});

test('does not identify an unknown, ambiguous, scrolling or oversized header as recoverable', () => {
  for (const options of [
    { branded: false }, { duplicate: true }, { position: 'static' },
    { top: 10 }, { bottom: 0 }, { bottom: 400 },
  ]) assert.equal(inspectFixture(options).headerBottom, null);
});

test('a successful native click performs no recovery or extra observation', async () => {
  const { page, calls } = browser({ errors: [] });
  const recoveries = [];
  await clickButton(page, name, recoveries);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'click');
  assert.deepEqual(recoveries, []);
});

test('partially offscreen button recovery scrolls once and observes stability before the sole retry', async () => {
  const { page, calls } = browser({ observations: [clipped(), exposed(), exposed()] });
  const recoveries = [];
  await clickButton(page, name, recoveries);
  assert.deepEqual(calls.map((call) => call.type), [
    'click', 'observe', 'move', 'wheel', 'snapshot', 'observe', 'wait', 'observe', 'click',
  ]);
  assert.deepEqual(calls.find((call) => call.type === 'wheel'), { type: 'wheel', x: 0, y: -190 });
  assert.equal(calls.find((call) => call.type === 'wait').duration, 100);
  assert.equal(recoveries.length, 1);
  assert.equal(recoveries[0].settled, true);
  assert.equal(recoveries[0].before.y, -8);
  for (const click of calls.filter((call) => call.type === 'click')) {
    assert.equal(click.options.timeout, 3000);
    assert.equal(click.options.force, undefined);
  }
});

test('a directly observed header interception also recovers through native wheel input', async () => {
  const before = clipped({
    rect: { x: 300, y: 0, width: 180, height: 44 }, y: 22,
    interceptedBy: 'HEADER', interceptedByKnownHeader: true,
  });
  const { page, calls } = browser({ observations: [before, exposed(), exposed()] });
  await clickButton(page, name, []);
  assert.equal(calls.filter((call) => call.type === 'click').length, 2);
  assert.equal(calls.find((call) => call.type === 'wheel').y, -160);
});

test('layout motion after scrolling is reobserved until two exposed bounds agree', async () => {
  const { page, calls } = browser({ observations: [clipped(), exposed(130), exposed(180), exposed(180)] });
  const recoveries = [];
  await clickButton(page, name, recoveries);
  assert.equal(calls.filter((call) => call.type === 'observe').length, 4);
  assert.equal(calls.filter((call) => call.type === 'wait').length, 2);
  assert.equal(recoveries[0].after.rect.y, 180);
});

for (const [label, state] of [
  ['unknown overlay', clipped({ y: 20, rect: { x: 300, y: -2, width: 180, height: 44 }, interceptedBy: 'DIV' })],
  ['unidentified header', clipped({ headerBottom: null })],
  ['disabled button', clipped({ disabled: true })],
  ['ambiguous button', { count: 2 }],
  ['already exposed button', clipped({ receivesInput: true })],
  ['fully above viewport', clipped({ rect: { x: 300, y: -70, width: 180, height: 44 }, y: -48 })],
  ['below viewport', clipped({ rect: { x: 300, y: 900, width: 180, height: 44 }, y: 922 })],
  ['horizontally clipped button', clipped({ rect: { x: -20, y: -30, width: 180, height: 44 }, x: 70 })],
  ['page already at top', clipped({ scrollY: 0 })],
  ['insufficient scroll distance', clipped({ scrollY: 100 })],
  ['nonfinite bounds', clipped({ rect: { x: 300, y: NaN, width: 180, height: 44 } })],
  ['scroll exceeding half a viewport', clipped({ height: 260 })],
]) {
  test(`does not attempt to recover ${label}`, async () => {
    const original = resolutionError();
    const { page, calls } = browser({ observations: [state], errors: [original] });
    const recoveries = [];
    await assert.rejects(clickButton(page, name, recoveries), (error) => error === original);
    assert.deepEqual(calls.map((call) => call.type), ['click', 'observe']);
    assert.deepEqual(recoveries, []);
  });
}

test('dispatch and unclassified timeouts never retry, even if the message includes interception text', async () => {
  for (const type of ['TimeoutError', 'Error', 'ProtocolError']) {
    const original = Object.assign(new Error('Input.dispatchMouseEvent timed out; none can receive input'), { name: type });
    const { page, calls } = browser({ errors: [original] });
    await assert.rejects(clickButton(page, name, []), (error) => error === original);
    assert.deepEqual(calls.map((call) => call.type), ['click']);
  }
});

test('a non-actionability locator error is not treated as header clipping', async () => {
  const original = Object.assign(new Error('Locator matched multiple elements'), { name: 'ElementResolutionError' });
  const { page, calls } = browser({ errors: [original] });
  await assert.rejects(clickButton(page, name, []), (error) => error === original);
  assert.deepEqual(calls.map((call) => call.type), ['click']);
});

test('continuous layout movement stops after five observations without clicking again', async () => {
  const { page, calls } = browser({ observations: [clipped(), ...[130, 140, 150, 160, 170].map(exposed)] });
  const recoveries = [];
  await assert.rejects(clickButton(page, name, recoveries), /did not expose a stable button/);
  assert.equal(calls.filter((call) => call.type === 'observe').length, 6);
  assert.equal(calls.filter((call) => call.type === 'wait').length, 4);
  assert.equal(calls.filter((call) => call.type === 'click').length, 1);
  assert.equal(calls.filter((call) => call.type === 'wheel').length, 1);
  assert.equal(recoveries[0].settled, false);
});

test('a new overlay after scrolling remains a failure and never triggers a second scroll', async () => {
  const blocked = { ...exposed(), receivesInput: false, interceptedBy: 'DIV' };
  const { page, calls } = browser({ observations: [clipped(), ...Array(5).fill(blocked)] });
  await assert.rejects(clickButton(page, name, []), /did not expose a stable button/);
  assert.equal(calls.filter((call) => call.type === 'click').length, 1);
  assert.equal(calls.filter((call) => call.type === 'wheel').length, 1);
});

test('the sole retry failure propagates without repeating input or recovery', async () => {
  const second = resolutionError();
  const { page, calls } = browser({ observations: [clipped(), exposed(), exposed()], errors: [resolutionError(), second] });
  await assert.rejects(clickButton(page, name, []), (error) => error === second);
  assert.equal(calls.filter((call) => call.type === 'click').length, 2);
  assert.equal(calls.filter((call) => call.type === 'wheel').length, 1);
});
