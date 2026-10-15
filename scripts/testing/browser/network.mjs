import { validatePreviewUrl } from './config.mjs';

const DEVELOPMENT_HOST = 'fhytkbjadhnmozppolrv.supabase.co';
const STATIC_HOSTS = new Set(['flagcdn.com', 'fonts.gstatic.com', 'fonts.googleapis.com']);
const PRETENDARD_PATH = /^\/gh\/orioncactus\/pretendard@v1\.3\.9\/(?:packages\/pretendard\/)?dist\/web\/variable\/(?:pretendardvariable-dynamic-subset\.min\.css|woff2-dynamic-subset\/PretendardVariable\.subset\.\d+\.woff2)$/;
const TOOLBAR_PATH = '/_next-live/feedback/feedback.js';
const RESOURCE_TYPES = new Set(['Document', 'Stylesheet', 'Image', 'Media', 'Font', 'Script', 'TextTrack', 'XHR', 'Fetch', 'Prefetch', 'EventSource', 'WebSocket', 'Manifest', 'SignedExchange', 'Ping', 'CSPViolationReport', 'Preflight', 'Other']);

/** Classify in memory; never persist arbitrary protocol messages or headers. */
export function classifyProtocolFailure(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error?.name === 'NetworkGuardDeadline') return 'deadline';
  if (/(?:^|Protocol error \(Fetch\.(?:continueRequest|failRequest)\): )Invalid InterceptionId\.$/.test(message)) return 'invalid-interception-id';
  if (/(?:^|: )Invalid requestId\.?$/.test(message)) return 'invalid-request-id';
  if (/(?:^|: )No resource with given identifier found\.?$/.test(message)) return 'resource-not-found';
  if (/Invalid InterceptionId|Invalid interception id|Invalid requestId|No resource with given identifier|No request with given id|Could not find request with given id/i.test(message)) return 'request-id-unavailable';
  if (/Target closed|Session closed|Target page, context or browser has been closed|No target with given id/i.test(message)) return 'target-closed';
  if (/Unsafe header/i.test(message)) return 'unsafe-header';
  if (/Invalid http status code or phrase/i.test(message)) return 'invalid-http-status';
  if (/Protocol error/i.test(message)) return 'protocol-error';
  return 'unknown';
}

/** Every redirect hop is classified independently, including iframe documents. */
export function classifyDestination(value, { previewOrigin, method = 'GET', resourceType, navigation = false } = {}) {
  let url;
  try { url = new URL(value); } catch { return 'forbidden'; }
  if (url.username || url.password || url.port) return 'forbidden';
  if (navigation || resourceType === 'Document') return url.origin === previewOrigin || url.href === 'about:blank' ? 'allowed' : 'forbidden';
  const preview = new URL(previewOrigin);
  if (['https:', 'wss:'].includes(url.protocol) &&
    (url.hostname === preview.hostname || url.hostname === DEVELOPMENT_HOST)) return 'allowed';
  if (url.protocol !== 'https:') return 'forbidden';
  // The optional Vercel feedback toolbar is explicitly excluded, never fetched.
  // Other Vercel hosts, paths, methods and document loads remain test failures.
  if (url.hostname === 'vercel.live' && url.pathname === TOOLBAR_PATH && method === 'GET' && resourceType === 'Script') return 'excluded-tooling';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) return 'forbidden';
  if (STATIC_HOSTS.has(url.hostname)) return 'allowed';
  if (url.hostname === 'cdn.jsdelivr.net' && PRETENDARD_PATH.test(url.pathname)) return 'allowed';
  return 'forbidden';
}

export function forbiddenDestination(url, options) {
  return classifyDestination(url, options) !== 'allowed';
}

function summarize(request) {
  try {
    const url = new URL(request.url);
    return { host: url.hostname, path: url.pathname };
  } catch { return { host: 'invalid', path: '' }; }
}

async function deadline(operation, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => {
        const error = new Error(`${label} did not complete; network guard is unconfirmed`);
        error.name = 'NetworkGuardDeadline';
        reject(error);
      }, 5000); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Request-stage CDP interception also pauses redirects that Playwright routes skip. */
export function createNetworkGuard(protocol, { previewOrigin, receipt }) {
  validatePreviewUrl(previewOrigin);
  receipt.forbiddenRequests ??= [];
  receipt.excludedToolingRequests ??= [];
  receipt.networkGuard = { enabled: false, requestsChecked: 0, redirectHopsChecked: 0, errors: [], diagnostics: [], terminalMissingInterceptions: 0, canceledRequestsObserved: 0, finishedRequestsObserved: 0, closed: false };
  const pending = new Set();
  const handledRequests = new Set();
  const terminalRequests = new Map();
  const remember = (id, state) => {
    if (typeof id !== 'string') return;
    terminalRequests.delete(id);
    terminalRequests.set(id, state);
    if (terminalRequests.size > 2000) terminalRequests.delete(terminalRequests.keys().next().value);
  };
  const onRequest = (event) => { terminalRequests.delete(event.requestId); };
  const onFailed = (event) => {
    if (event.canceled === true) receipt.networkGuard.canceledRequestsObserved++;
    remember(event.requestId, { canceled: event.canceled === true, aborted: event.errorText === 'net::ERR_ABORTED', finished: false });
  };
  const onFinished = (event) => {
    receipt.networkGuard.finishedRequestsObserved++;
    remember(event.requestId, { canceled: false, aborted: false, finished: true });
  };
  let closing = false;
  let failure;
  let rejectFailure;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  failed.catch(() => {}); // The launcher attaches its race after setup completes.
  const fail = (message, operation) => {
    if (operation) receipt.networkGuard.errors.push(operation);
    if (!failure) {
      failure = new Error(message);
      rejectFailure(failure);
    }
  };
  const send = async (method, params, event, allowMissingInterception = false) => {
    try { return await deadline(() => protocol.send(method, params), method); }
    catch (error) {
      const terminal = terminalRequests.get(event?.networkId);
      const kind = classifyProtocolFailure(error);
      const diagnostic = {
        operation: method, kind, phase: closing ? 'closing' : 'active',
        resourceType: RESOURCE_TYPES.has(event?.resourceType) ? event.resourceType : 'unknown',
        redirectHop: Boolean(event?.redirectedRequestId), networkIdPresent: typeof event?.networkId === 'string',
        canceledObserved: terminal?.canceled === true, abortedObserved: terminal?.aborted === true,
        finishedObserved: terminal?.finished === true,
      };
      if (receipt.networkGuard.diagnostics.length < 200) receipt.networkGuard.diagnostics.push(diagnostic);
      if (allowMissingInterception && method === 'Fetch.continueRequest' && kind === 'invalid-interception-id') {
        // Chromium FindJob returns this exact error only after the interception
        // job is absent. Do not infer cancellation or retry a vanished job.
        diagnostic.disposition = 'terminal-missing-interception';
        receipt.networkGuard.terminalMissingInterceptions++;
        return;
      }
      throw Object.assign(new Error('Intercepted network operation failed'), { operation: method });
    }
  };

  async function handle(event) {
    if (typeof event.requestId !== 'string' || !event.requestId || !event.request) {
      fail('Malformed intercepted request; network verification failed', 'malformed-request');
      return;
    }
    const { requestId, request } = event;
    if (handledRequests.has(requestId)) {
      fail('Duplicate intercepted request; network verification failed', 'duplicate-request');
      await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, event);
      return;
    }
    handledRequests.add(requestId);
    if (event.responseStatusCode !== undefined || event.responseErrorReason !== undefined) {
      fail('Unexpected response-stage interception; network verification failed', 'unexpected-response-stage');
      await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, event);
      return;
    }
    const decision = closing ? 'forbidden' : classifyDestination(request.url, {
      previewOrigin, method: request.method, resourceType: event.resourceType,
    });
    receipt.networkGuard.requestsChecked++;
    if (event.redirectedRequestId) receipt.networkGuard.redirectHopsChecked++;
    if (decision !== 'allowed') {
      if (!closing) {
        const list = decision === 'excluded-tooling' ? receipt.excludedToolingRequests : receipt.forbiddenRequests;
        if (list.length < 1000) list.push(summarize(request));
      }
      if (!closing && decision === 'forbidden') fail('A forbidden backend or navigation was blocked; regression verification failed');
      await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, event);
      return;
    }
    const entries = Object.entries(request.headers ?? {});
    const filtered = entries.filter(([name]) => name.toLowerCase() !== 'x-vercel-protection-bypass');
    // Do not override ordinary headers: preserve Chromium's native cookie and
    // Authorization redirect policy. CDP overrides apply to this one hop only.
    const params = { requestId };
    if (filtered.length !== entries.length) params.headers = filtered.map(([name, value]) => ({ name, value }));
    await send('Fetch.continueRequest', params, event, true);
  }

  const onPaused = (event) => {
    const work = handle(event).catch(async (error) => {
      // Protocol errors may echo request headers. Keep only fixed labels.
      if (!closing) fail('Network interception failed; refusing incomplete verification', 'request-handler');
      if (event?.requestId && error.operation !== 'Fetch.failRequest') {
        try { await send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }, event); }
        catch { if (!closing) fail('Network interception cleanup failed', 'fail-request'); }
      }
    });
    pending.add(work);
    work.finally(() => pending.delete(work));
  };

  return {
    failed,
    async start() {
      protocol.on('Fetch.requestPaused', onPaused);
      protocol.on('Network.requestWillBeSent', onRequest);
      protocol.on('Network.loadingFailed', onFailed);
      protocol.on('Network.loadingFinished', onFinished);
      try {
        await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
        receipt.networkGuard.enabled = true;
      } catch {
        fail('Could not enable every-hop network protection', 'enable');
        throw failure;
      }
    },
    async assertHealthy() {
      await deadline(async () => {
        while (pending.size) await Promise.all([...pending]);
      }, 'Network verification settlement');
      if (failure) throw failure;
    },
    beginClose() { closing = true; },
    async dispose({ browserClosed }) {
      if (!browserClosed) throw new Error('Cannot remove network protection before its owned browser or context closes');
      closing = true;
      // Never Fetch.disable while the page is live: that would release paused
      // requests. Closing the owned context/browser cancels them first.
      await deadline(async () => {
        while (pending.size) await Promise.all([...pending]);
      }, 'Network cleanup settlement');
      protocol.off('Fetch.requestPaused', onPaused);
      protocol.off('Network.requestWillBeSent', onRequest);
      protocol.off('Network.loadingFailed', onFailed);
      protocol.off('Network.loadingFinished', onFinished);
      terminalRequests.clear();
      handledRequests.clear();
      receipt.networkGuard.closed = true;
    },
  };
}
