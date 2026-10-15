import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runRegressionSession } from './session.mjs';
import { validatePreviewUrl } from './config.mjs';
import { createNetworkGuard, forbiddenDestination } from './network.mjs';
export { forbiddenDestination } from './network.mjs';

const PROTOCOL_EVENTS = [
  'Network.requestWillBeSent', 'Debugger.scriptParsed', 'Debugger.paused',
  'Runtime.executionContextCreated', 'Page.screencastFrame', 'Page.screencastVisibilityChanged',
];

/** A timeout does not cancel dispatched input and must never cause a retry. */
export async function withDeadline(operation, timeout, label, name = 'BrowserOperationTimeout') {
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 30_000) throw new Error('Invalid browser operation deadline');
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`${label} exceeded its deadline; no retry is allowed because dispatch may have late effects.`);
          error.name = name;
          reject(error);
        }, timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Translate only the selector forms used by the shared native-input suite. */
export function suiteLocator(page, selector) {
  if (typeof selector !== 'string' || !selector) throw new Error('A browser selector is required');
  if (selector.startsWith('loc=role:')) {
    const match = /^loc=role:([a-z][a-z0-9-]*)\[name=("(?:[^"\\]|\\.)*")\]$/.exec(selector);
    if (!match) throw new Error('Unsupported role selector; use one exact JSON-quoted accessible name');
    return page.getByRole(match[1], { name: JSON.parse(match[2]), exact: true });
  }
  if (selector.startsWith('loc=href:')) return page.locator(`a[href=${JSON.stringify(selector.slice(9))}]`);
  if (selector.startsWith('loc=css:')) return page.locator(selector.slice(8));
  if (/^(?:loc=|ref=|@)/.test(selector)) throw new Error('Unsupported browser selector');
  return page.locator(selector);
}

function actionOptions(options = {}) {
  if (options.force) throw new Error('Forced browser input is not permitted');
  return Object.fromEntries(Object.entries(options).filter(([name]) => name !== 'label' && name !== 'force'));
}

export function createChromiumPage(page, protocol, { previewOrigin, space = 1 } = {}) {
  const pending = [];
  let overflow = false;
  for (const method of PROTOCOL_EVENTS) {
    protocol.on(method, (params) => {
      // Fail instead of losing a write request when a noisy page fills the buffer.
      if (pending.length >= 20_000) overflow = true;
      else pending.push({ method, params });
    });
  }
  const locator = (selector) => suiteLocator(page, selector);
  const nativeInput = (operation, name) => withDeadline(operation, 15_000, name);
  const adapter = {
    label: 'p1', spaceId: space, openedBy: 'agent',
    async cdp(method, params = {}, { timeout = 10_000 } = {}) {
      return withDeadline(() => protocol.send(method, params), timeout, `CDP ${method}`, 'CdpRequestTimeout');
    },
    async events() {
      if (overflow) throw new Error('Protocol evidence overflowed; refusing incomplete request verification');
      return pending.splice(0);
    },
    async goto(url, options) {
      if (new URL(url).origin !== previewOrigin) throw new Error('Only the verified Preview origin may be navigated');
      return page.goto(url, { waitUntil: 'load', timeout: 30_000, ...options });
    },
    reload: (options) => page.reload({ waitUntil: 'load', timeout: 30_000, ...options }),
    url: async () => page.url(),
    evaluate: (fn, argument) => withDeadline(() => page.evaluate(fn, argument), 20_000, 'Page evaluation'),
    snapshot: () => page.locator('body').ariaSnapshot({ timeout: 10_000 }),
    screenshot: (options = {}) => page.screenshot({ ...options, timeout: 20_000 }),
    waitForSelector: (selector, options = {}) => locator(selector).waitFor({ timeout: 15_000, ...options }),
    waitForURL: (url, options = {}) => page.waitForURL(url, { timeout: 15_000, ...options }),
    waitForFunction: (fn, argument, options = {}) => page.waitForFunction(fn, argument, { timeout: 15_000, ...options }),
    waitForTimeout: (ms) => page.waitForTimeout(ms),
    click: (selector, options) => locator(selector).click({ timeout: 3000, ...actionOptions(options) }),
    fill: (selector, value, options) => locator(selector).fill(value, { timeout: 5000, ...actionOptions(options) }),
    press: (selector, key, options) => locator(selector).press(key, { timeout: 5000, ...actionOptions(options) }),
    focus: (selector, options) => locator(selector).focus({ timeout: 5000, ...actionOptions(options) }),
    setInputFiles: (selector, files) => locator(selector).setInputFiles(files, { timeout: 10_000 }),
    mouse: {
      move: (x, y, options) => nativeInput(() => page.mouse.move(x, y, actionOptions(options)), 'Native pointer move'),
      down: (options) => nativeInput(() => page.mouse.down(actionOptions(options)), 'Native pointer down'),
      up: (options) => nativeInput(() => page.mouse.up(actionOptions(options)), 'Native pointer up'),
      wheel: (x, y) => nativeInput(() => page.mouse.wheel(x, y), 'Native wheel'),
      click: (x, y, options) => nativeInput(() => page.mouse.click(x, y, actionOptions(options)), 'Native pointer click'),
    },
    keyboard: {
      press: (key, options) => nativeInput(() => page.keyboard.press(key, actionOptions(options)), 'Native keyboard press'),
      down: (key) => nativeInput(() => page.keyboard.down(key), 'Native keyboard down'),
      up: (key) => nativeInput(() => page.keyboard.up(key), 'Native keyboard up'),
    },
  };
  return adapter;
}

function cleanBrowserEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([name]) =>
    !/^(?:FAIRGROUND|FESTIVAL|SUPABASE|NEXT_PUBLIC_|VERCEL|PG|OPENROUTER)/.test(name) &&
    !/(?:PASSWORD|SECRET|TOKEN|API_KEY)/i.test(name)));
}

function interrupted(signal) {
  return new Promise((_, reject) => {
    if (!signal) return;
    const abort = () => reject(new Error('Isolated Chromium session interrupted; closing its browser without retrying input'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

/** Obtain a host-scoped bypass cookie without putting the secret in page traffic. */
export async function bootstrapPreviewProtection(context, previewOrigin, secret) {
  let response;
  try {
    response = await context.request.get(previewOrigin + '/', {
      headers: { 'x-vercel-protection-bypass': secret, 'x-vercel-set-bypass-cookie': 'true' },
      maxRedirects: 0, timeout: 10_000,
    });
    const location = response.headers().location;
    if (response.status() < 300 || response.status() >= 400 || !location ||
      new URL(location, previewOrigin).origin !== previewOrigin) {
      throw new Error('Preview cookie bootstrap did not return an expected same-origin redirect');
    }
    const cookies = await context.cookies();
    const hostname = new URL(previewOrigin).hostname;
    if (cookies.length !== 1 || cookies.some((cookie) =>
      cookie.name !== '_vercel_jwt' || cookie.domain !== hostname || cookie.path !== '/' ||
      cookie.secure !== true || cookie.httpOnly !== true || !cookie.value)) {
      throw new Error('Preview cookie bootstrap did not produce only secure host-scoped cookies');
    }
    return cookies.length;
  } catch {
    // The underlying request error can echo supplied headers. Never propagate
    // it into the browser suite, its diagnostics, or child process output.
    throw new Error('Could not safely establish the existing Preview protection cookie');
  } finally {
    await response?.dispose().catch(() => {});
  }
}

/** Launch only a bundled, temporary Chromium; never attach to a user's browser. */
export async function runIsolatedChromiumSession({ config, credentials, signal }, {
  chromium, runSession = runRegressionSession, environment = process.env,
} = {}) {
  if (config.engine !== 'chromium' || config.space !== 1 || config.page !== 'p1' || config.isolateExtension != null) {
    throw new Error('Isolated Chromium requires its own p1 context and no user-extension isolation');
  }
  const previewOrigin = validatePreviewUrl(config.url);
  if (credentials?.protectionBypass != null &&
    (typeof credentials.protectionBypass !== 'string' || !credentials.protectionBypass || /[\r\n]/.test(credentials.protectionBypass))) {
    throw new Error('Invalid Preview protection credential');
  }
  if (signal?.aborted) throw new Error('Isolated Chromium was interrupted before launch');
  const receipt = {
    engine: 'chromium', status: 'running', headless: true,
    profile: 'playwright-managed-system-temporary', persistentContext: false,
    extensions: 'disabled', userBrowserAttached: false, serviceWorkers: 'blocked',
    networkPolicy: 'exact-preview-and-dev-db-with-read-only-static-hosts',
    viewport: { width: 1512, height: 828, deviceScaleFactor: 1 },
    browserLaunched: false, contextClosed: false, browserClosed: false,
    previewProtection: credentials?.protectionBypass ? 'secure-host-cookie-bootstrap' : 'none',
    forbiddenRequests: [],
  };
  let browser;
  let context;
  let running;
  let failure;
  let networkGuard;
  let popupFailure;
  let rejectPopup;
  const unexpectedPopup = new Promise((_, reject) => { rejectPopup = reject; });
  unexpectedPopup.catch(() => {});
  try {
    const launcher = chromium ?? (await import('playwright')).chromium;
    browser = await launcher.launch({
      headless: true, args: ['--disable-extensions'], timeout: 30_000,
      env: cleanBrowserEnvironment(environment),
      // Our signal handler awaits cleanup and its receipt instead of allowing
      // Playwright's default signal handler to exit before evidence is saved.
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    });
    receipt.browserLaunched = true;
    if (signal?.aborted) throw new Error('Isolated Chromium interrupted during launch');
    context = await browser.newContext({
      viewport: { width: 1512, height: 828 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', acceptDownloads: false,
    });
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(30_000);
    if (credentials?.protectionBypass) {
      receipt.previewProtectionCookieCount = await bootstrapPreviewProtection(context, previewOrigin, credentials.protectionBypass);
    }
    await context.routeWebSocket('**/*', (socket) => {
      if (forbiddenDestination(socket.url(), { previewOrigin })) {
        const parsed = new URL(socket.url());
        receipt.forbiddenRequests.push({ host: parsed.hostname, path: parsed.pathname });
        socket.close();
      } else socket.connectToServer();
    });
    const page = await context.newPage();
    context.on('page', (extraPage) => {
      if (extraPage === page) return;
      popupFailure = new Error('An unexpected extra Page was opened; the regression only permits its owned p1');
      receipt.unexpectedPages = (receipt.unexpectedPages ?? 0) + 1;
      rejectPopup(popupFailure);
      extraPage.close().catch(() => {}); // Owned isolated context only; cleanup also closes the context.
    });
    const protocol = await context.newCDPSession(page);
    networkGuard = createNetworkGuard(protocol, { previewOrigin, receipt });
    await networkGuard.start();
    const adapter = createChromiumPage(page, protocol, { previewOrigin });
    const task = {
      spaceId: 1,
      page(label) {
        if (label !== 'p1') throw new Error('Only the isolated owned p1 is available');
        return adapter;
      },
    };
    const taskSpace = async (id) => {
      if (id !== 1) throw new Error('Cannot connect to an external TaskSpace');
      return task;
    };
    running = runSession({ taskSpace, config, credentials });
    await Promise.race([running, interrupted(signal), networkGuard.failed, unexpectedPopup]);
    await networkGuard.assertHealthy();
    if (popupFailure) throw popupFailure;
    if (receipt.forbiddenRequests.length) throw new Error('A forbidden backend or navigation was blocked; regression verification failed');
  } catch (error) {
    failure = error;
  } finally {
    networkGuard?.beginClose();
    // Closing the context aborts any timed-out pending browser operation. It is
    // never reused, and neither cleanup operation dispatches application input.
    if (context) {
      try {
        await withDeadline(() => context.close(), 10_000, 'Isolated context cleanup');
        receipt.contextClosed = true;
      } catch (error) { failure ??= error; }
    }
    if (browser) {
      try {
        await withDeadline(() => browser.close(), 10_000, 'Isolated browser cleanup');
        receipt.browserClosed = !browser.isConnected();
        if (!receipt.browserClosed) throw new Error('Isolated browser disconnection was not confirmed');
      } catch (error) { failure ??= error; }
    }
    if (running) {
      try { await withDeadline(() => running, 5000, 'Session settlement'); }
      catch (error) { failure ??= error; }
    }
    if (networkGuard) {
      try { await networkGuard.dispose({ browserClosed: receipt.contextClosed || receipt.browserClosed }); }
      catch (error) { failure ??= error; }
    }
    receipt.status = failure ? 'failed' : 'passed';
    if (failure) receipt.failure = failure.name;
    // Persistence failures also reject this operation; a missing cleanup
    // receipt must never be reported as successful verification.
    await writeFile(path.join(config.output, 'chromium-cleanup.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  }
  if (failure) throw failure;
  return receipt;
}
