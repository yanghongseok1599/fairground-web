import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  bootstrapPreviewProtection, createChromiumPage, forbiddenDestination, runIsolatedChromiumSession, suiteLocator,
} from '../scripts/testing/browser/chromium.mjs';

const previewOrigin = 'https://fairground-7idyy4r9g-milestones-projects-d52c4dda.vercel.app';
const password = 'fixture-password-that-must-not-be-recorded';

test('selector translation preserves exact accessible names and quoted href attributes', () => {
  const page = {
    getByRole: (role, options) => ({ kind: 'role', role, options }),
    locator: (selector) => ({ kind: 'css', selector }),
  };
  assert.deepEqual(suiteLocator(page, 'loc=role:button[name="팀 정보 수정"]'), {
    kind: 'role', role: 'button', options: { name: '팀 정보 수정', exact: true },
  });
  const name = 'A "quoted" \\ name';
  assert.equal(suiteLocator(page, `loc=role:menuitem[name=${JSON.stringify(name)}]`).options.name, name);
  assert.deepEqual(suiteLocator(page, 'loc=href:/login'), { kind: 'css', selector: 'a[href="/login"]' });
  assert.deepEqual(suiteLocator(page, 'loc=css:#editTeamName'), { kind: 'css', selector: '#editTeamName' });
  assert.deepEqual(suiteLocator(page, 'input[name="email"]'), { kind: 'css', selector: 'input[name="email"]' });
  for (const selector of ['loc=role:button[name*=\"팀\"]', 'loc=role:button', '@21', 'loc=unknown:button']) {
    assert.throws(() => suiteLocator(page, selector), /Unsupported/);
  }
});

test('page input delegates to native locators without force or DOM click', async () => {
  const calls = [];
  const page = {
    getByRole: (role, options) => ({ click: async (clickOptions) => calls.push({ role, options, clickOptions }) }),
  };
  const adapter = createChromiumPage(page, new EventEmitter(), { previewOrigin });
  await adapter.click('loc=role:button[name="취소"]', { label: '취소 클릭', timeout: 1250 });
  assert.deepEqual(calls, [{ role: 'button', options: { name: '취소', exact: true }, clickOptions: { timeout: 1250 } }]);
  assert.throws(() => adapter.click('loc=role:button[name="취소"]', { force: true }), /Forced/);
  assert.equal(calls.length, 1);
});

test('a timed-out CDP request is dispatched once and its late result cannot trigger retry', async () => {
  let finish;
  let dispatched = 0;
  const protocol = new EventEmitter();
  protocol.send = () => { dispatched++; return new Promise((resolve) => { finish = resolve; }); };
  const adapter = createChromiumPage({}, protocol, { previewOrigin });
  await assert.rejects(adapter.cdp('Input.dispatchMouseEvent', {}, { timeout: 15 }), (error) => {
    assert.equal(error.name, 'CdpRequestTimeout');
    assert.match(error.message, /late effects/);
    return true;
  });
  finish({ late: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(dispatched, 1);
  await assert.rejects(adapter.cdp('Page.getLayoutMetrics', {}, { timeout: 0 }), /deadline/);
  assert.equal(dispatched, 1);
});

test('protocol events retain raw shape, drain once, and fail on incomplete evidence', async () => {
  const protocol = new EventEmitter();
  const adapter = createChromiumPage({}, protocol, { previewOrigin });
  const params = { request: { method: 'POST', url: `${previewOrigin}/api/test` } };
  protocol.emit('Network.requestWillBeSent', params);
  assert.deepEqual(await adapter.events(), [{ method: 'Network.requestWillBeSent', params }]);
  assert.deepEqual(await adapter.events(), []);
  for (let i = 0; i < 20_001; i++) protocol.emit('Debugger.scriptParsed', { url: 'fixture.js' });
  await assert.rejects(adapter.events(), /overflowed/);
});

test('foreign Supabase and non-Preview top-level navigation are refused before connection', () => {
  assert.equal(forbiddenDestination('https://fhytkbjadhnmozppolrv.supabase.co/rest/v1/teams', { previewOrigin }), false);
  assert.equal(forbiddenDestination('wss://production-ref.supabase.co/realtime/v1', { previewOrigin }), true);
  assert.equal(forbiddenDestination('https://other-ref.supabase.co/auth/v1/token', { previewOrigin }), true);
  assert.equal(forbiddenDestination(previewOrigin + '/teams', { previewOrigin, navigation: true }), false);
  assert.equal(forbiddenDestination('https://fairground.run/teams', { previewOrigin, navigation: true }), true);
  assert.equal(forbiddenDestination('https://fonts.gstatic.com/font.woff', { previewOrigin }), false);
  assert.equal(forbiddenDestination('https://fonts.gstatic.com/font.woff', { previewOrigin, method: 'POST' }), true);
  for (const url of [
    'https://fairground-kor.com/api/teams', 'https://www.fairground-kor.com/api/teams',
    'https://fairground-futsal.vercel.app/api/teams', 'https://fairground-footsal.vercel.app/api/teams',
    'wss://fairground-kor.com/socket', 'https://fairground-other-milestones-projects-d52c4dda.vercel.app/api/teams',
    'https://unapproved.example/api/data', 'http://fhytkbjadhnmozppolrv.supabase.co/rest/v1/teams',
  ]) assert.equal(forbiddenDestination(url, { previewOrigin }), true, url);
});

test('Preview bootstrap sends the credential once without redirects and verifies only its host cookie', async () => {
  const calls = [];
  const secret = 'fixture-bypass-secret';
  const context = {
    request: { get: async (url, options) => {
      calls.push({ url, options });
      return { status: () => 307, headers: () => ({ location: previewOrigin + '/' }), dispose: async () => calls.push('dispose') };
    } },
    cookies: async () => [{ name: '_vercel_jwt', domain: new URL(previewOrigin).hostname, path: '/', secure: true, httpOnly: true, value: 'cookie-secret' }],
  };
  assert.equal(await bootstrapPreviewProtection(context, previewOrigin, secret), 1);
  assert.deepEqual(calls, [{
    url: previewOrigin + '/', options: {
      headers: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' }, maxRedirects: 0, timeout: 10_000,
    },
  }, 'dispose']);
});

test('Preview bootstrap rejects external redirects, absent or broad cookies, and redacts request failures', async () => {
  const cookie = { name: '_vercel_jwt', domain: new URL(previewOrigin).hostname, path: '/', secure: true, httpOnly: true, value: 'cookie-secret' };
  for (const change of [
    { location: 'https://external.example/' }, { status: 200 }, { cookies: [] },
    { cookies: [{ ...cookie, domain: '.vercel.app' }] }, { cookies: [{ ...cookie, secure: false }] },
    { cookies: [{ ...cookie, httpOnly: false }] }, { cookies: [{ ...cookie, name: 'unrelated-cookie' }] },
    { fail: true },
  ]) {
    let disposed = false;
    const context = {
      request: { get: async () => {
        if (change.fail) throw new Error('Request log x-vercel-protection-bypass: fixture-bypass-secret');
        return { status: () => change.status ?? 307, headers: () => ({ location: change.location ?? '/' }), dispose: async () => { disposed = true; } };
      } },
      cookies: async () => change.cookies ?? [cookie],
    };
    await assert.rejects(bootstrapPreviewProtection(context, previewOrigin, 'fixture-bypass-secret'), (error) => {
      assert.equal(error.message, 'Could not safely establish the existing Preview protection cookie');
      assert.ok(!error.message.includes('fixture-bypass-secret'));
      return true;
    });
    assert.equal(disposed, !change.fail);
  }
});

async function fixture(t) {
  const output = await mkdtemp(path.join(tmpdir(), 'fairground-chromium-test-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const calls = [];
  const page = {};
  const protocol = new EventEmitter();
  const protocolCalls = [];
  protocol.send = async (method, params) => { protocolCalls.push({ method, params }); return {}; };
  const pageEvents = new EventEmitter();
  const context = {
    setDefaultTimeout: (value) => calls.push(['timeout', value]),
    setDefaultNavigationTimeout: (value) => calls.push(['navigation-timeout', value]),
    on: (...args) => pageEvents.on(...args),
    routeWebSocket: async (_, handler) => { context.socketGuard = handler; },
    newPage: async () => page,
    newCDPSession: async (actualPage) => { assert.equal(actualPage, page); return protocol; },
    close: async () => { calls.push(['context-close']); },
  };
  let connected = true;
  const browser = {
    newContext: async (options) => { calls.push(['context', options]); return context; },
    close: async () => { calls.push(['browser-close']); connected = false; },
    isConnected: () => connected,
  };
  const chromium = { launch: async (options) => { calls.push(['launch', options]); return browser; } };
  const config = { engine: 'chromium', space: 1, page: 'p1', url: previewOrigin, sha: 'a'.repeat(40), output };
  const credentials = { email: 'captain@example.com', password };
  const dependencies = {
    chromium,
    environment: { PATH: '/bin', FAIRGROUND_BROWSER_CAPTAIN_PASSWORD: password, SUPABASE_DB_URL: 'secret', VERCEL_TOKEN: 'secret', OTHER_SECRET: 'secret' },
    runSession: async ({ taskSpace, config: actualConfig, credentials: actualCredentials }) => {
      calls.push(['suite']);
      assert.equal(actualConfig, config);
      assert.equal(actualCredentials, credentials);
      const task = await taskSpace(1);
      assert.equal(task.page('p1').spaceId, 1);
      assert.throws(() => task.page('p2'), /owned p1/);
      await assert.rejects(taskSpace(86), /external TaskSpace/);
    },
  };
  return { output, calls, context, browser, config, credentials, dependencies, protocol, protocolCalls, pageEvents,
    input: { config, credentials },
    receipt: async () => JSON.parse(await readFile(path.join(output, 'chromium-cleanup.json'), 'utf8')),
  };
}

test('isolated lifecycle launches a fresh context and always closes it and its browser', async (t) => {
  const f = await fixture(t);
  const receipt = await runIsolatedChromiumSession(f.input, f.dependencies);
  const launch = f.calls.find(([name]) => name === 'launch')[1];
  assert.equal(launch.headless, true);
  assert.deepEqual(launch.args, ['--disable-extensions']);
  assert.deepEqual(launch.env, { PATH: '/bin' });
  assert.equal(launch.handleSIGTERM, false);
  assert.equal(launch.executablePath, undefined);
  assert.equal(launch.channel, undefined);
  assert.equal(launch.userDataDir, undefined);
  assert.deepEqual(f.calls.find(([name]) => name === 'context')[1], {
    viewport: { width: 1512, height: 828 }, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false,
  });
  assert.deepEqual(f.calls.slice(-3), [['suite'], ['context-close'], ['browser-close']]);
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.contextClosed, true);
  assert.equal(receipt.browserClosed, true);
  assert.equal(receipt.userBrowserAttached, false);
  assert.ok(!JSON.stringify(await f.receipt()).includes(password));
});

test('failed regression closes the browser exactly once and records no credential details', async (t) => {
  const f = await fixture(t);
  const failure = new Error(`Sensitive failure ${password}`);
  f.dependencies.runSession = async () => { throw failure; };
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), (error) => error === failure);
  const receipt = await f.receipt();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.failure, 'Error');
  assert.equal(receipt.browserClosed, true);
  assert.ok(!JSON.stringify(receipt).includes(password));
  assert.equal(f.calls.filter(([name]) => name === 'browser-close').length, 1);
});

test('context setup failure still closes the already launched browser', async (t) => {
  const f = await fixture(t);
  f.browser.newContext = async () => { throw new Error('context creation failed'); };
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), /context creation failed/);
  assert.equal((await f.receipt()).browserClosed, true);
  assert.equal((await f.receipt()).contextClosed, false);
  assert.equal(f.calls.some(([name]) => name === 'suite'), false);
});

test('context cleanup failure cannot prevent browser cleanup or report passing verification', async (t) => {
  const f = await fixture(t);
  f.context.close = async () => { throw new Error('context cleanup failed'); };
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), /context cleanup failed/);
  assert.equal((await f.receipt()).status, 'failed');
  assert.equal((await f.receipt()).browserClosed, true);
});

test('interruption stops the active session, closes owned browser, and persists failure', async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  let rejectSession;
  f.dependencies.runSession = () => new Promise((_, reject) => {
    rejectSession = reject;
    queueMicrotask(() => controller.abort());
  });
  f.context.close = async () => {
    f.calls.push(['context-close']);
    rejectSession(new Error('owned context closed'));
  };
  await assert.rejects(runIsolatedChromiumSession({ ...f.input, signal: controller.signal }, f.dependencies), /interrupted/);
  const receipt = await f.receipt();
  assert.equal(receipt.status, 'failed');
  assert.equal(receipt.contextClosed, true);
  assert.equal(receipt.browserClosed, true);
  assert.equal(f.calls.filter(([name]) => name === 'browser-close').length, 1);
});

test('blocked HTTP and WebSocket production requests fail even if app assertions pass', async (t) => {
  const f = await fixture(t);
  const blocked = [];
  f.dependencies.runSession = async () => {
    f.protocol.emit('Fetch.requestPaused', {
      requestId: 'request-1', resourceType: 'Fetch',
      request: { url: 'https://other-ref.supabase.co/rest/v1/teams', method: 'GET', headers: {} },
    });
    f.context.socketGuard({
      url: () => 'wss://other-ref.supabase.co/realtime/v1', close: () => blocked.push('websocket'),
      connectToServer: () => assert.fail('foreign realtime must not connect'),
    });
  };
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), /forbidden backend/);
  assert.deepEqual(blocked, ['websocket']);
  assert.ok(f.protocolCalls.some(({ method, params }) => method === 'Fetch.failRequest' && params.requestId === 'request-1'));
  assert.ok(!f.protocolCalls.some(({ method }) => method === 'Fetch.continueRequest'));
  assert.equal((await f.receipt()).forbiddenRequests.length, 2);
  assert.equal((await f.receipt()).browserClosed, true);
});

test('browser traffic never receives the automation bypass header on Preview or development requests', async (t) => {
  const f = await fixture(t);
  f.dependencies.runSession = async () => {
    let id = 0;
    for (const url of [previewOrigin + '/teams', 'https://fhytkbjadhnmozppolrv.supabase.co/rest/v1/teams', 'https://fonts.gstatic.com/font.woff']) {
      f.protocol.emit('Fetch.requestPaused', {
        requestId: `request-${++id}`, resourceType: 'Fetch',
        request: { url, method: 'GET', headers: { accept: '*/*', 'X-Vercel-Protection-Bypass': 'injected-secret', 'x-vercel-protection-bypass': 'injected-secret' } },
      });
    }
  };
  await runIsolatedChromiumSession(f.input, f.dependencies);
  assert.deepEqual(f.protocolCalls.filter(({ method }) => method === 'Fetch.continueRequest').map(({ params }) => params.headers),
    Array.from({ length: 3 }, () => [{ name: 'accept', value: '*/*' }]));
  assert.ok(!JSON.stringify(await f.receipt()).includes('injected-secret'));
});

test('an unexpected extra Page fails the suite and is closed inside the owned context', async (t) => {
  const f = await fixture(t);
  let closed = 0;
  f.dependencies.runSession = async () => { f.pageEvents.emit('page', { close: async () => { closed++; } }); };
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), /unexpected extra Page/);
  assert.equal(closed, 1);
  assert.equal((await f.receipt()).unexpectedPages, 1);
  assert.equal((await f.receipt()).browserClosed, true);
});

test('cleanup receipt persistence failure remains a failure after browser closes', async (t) => {
  const f = await fixture(t);
  f.config.output = path.join(f.output, 'nonexistent');
  await assert.rejects(runIsolatedChromiumSession(f.input, f.dependencies), { code: 'ENOENT' });
  assert.equal(f.browser.isConnected(), false);
});

test('user extension or external space options are rejected before browser launch', async (t) => {
  const f = await fixture(t);
  for (const change of [{ isolateExtension: 'aliprice' }, { space: 86 }, { page: 'p2' }, { engine: 'ego' }]) {
    await assert.rejects(runIsolatedChromiumSession({ ...f.input, config: { ...f.config, ...change } }, f.dependencies), /Isolated Chromium requires/);
  }
  assert.deepEqual(f.calls, []);
});
