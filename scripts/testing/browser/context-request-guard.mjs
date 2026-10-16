const OPERATION_TIMEOUT_MS = 5000;

async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Context request guard operation timed out')), OPERATION_TIMEOUT_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Gate the first request of every new target before Playwright emits its Page. */
export function createContextRequestGuard(context, { receipt }) {
  const state = receipt.contextRequestGuard = {
    enabled: false, ownedPageBound: false, requestsChecked: 0, blockedRequests: 0,
    errors: [], closed: false,
  };
  const pending = new Set();
  let ownedPage;
  let closing = false;
  let failure;
  let rejectFailure;
  const failed = new Promise((_, reject) => { rejectFailure = reject; });
  failed.catch(() => {});
  const fail = (kind) => {
    if (state.errors.length < 100) state.errors.push(kind);
    if (!failure) {
      failure = new Error(`Context request guard failed: ${kind}`);
      rejectFailure(failure);
    }
  };

  const handle = async (route) => {
    state.requestsChecked++;
    let rejection = closing ? 'context-closing' : null;
    if (!rejection) {
      try {
        const request = route.request();
        if (request.serviceWorker()) rejection = 'non-page-owner';
        else if (!ownedPage || request.frame().page() !== ownedPage) rejection = 'unowned-page';
      } catch {
        // Initial popup navigations and non-page requests can have no frame yet.
        // Never infer ownership from the URL or fall back to allowing a request.
        rejection = 'unavailable-owner';
      }
    }
    if (rejection) {
      state.blockedRequests++;
      try { await bounded(() => route.abort('blockedbyclient')); }
      catch { if (!closing) fail('abort-failed'); }
      // Settle the abort before waking browser cleanup whenever possible.
      if (!closing) fail(rejection);
      return;
    }
    try {
      // This route only establishes Page ownership. The p1 CDP guard still
      // classifies every redirect hop; Playwright routes skip redirected hops.
      await bounded(() => route.continue());
    } catch { if (!closing) fail('continue-failed'); }
  };
  const handler = (route) => {
    const work = handle(route).catch(() => { if (!closing) fail('request-handler-failed'); });
    pending.add(work);
    void work.finally(() => pending.delete(work));
    return work;
  };
  const settle = () => bounded(async () => {
    while (pending.size) await Promise.all([...pending]);
  });

  return {
    failed,
    async start() {
      try {
        await bounded(() => context.route('**/*', handler));
        state.enabled = true;
      } catch {
        fail('enable-failed');
        throw failure;
      }
    },
    bindOwnedPage(page) {
      if (!state.enabled || ownedPage || !page || closing) throw new Error('Context request ownership cannot be rebound');
      ownedPage = page;
      state.ownedPageBound = true;
    },
    async assertHealthy() {
      await settle();
      if (failure) throw failure;
    },
    beginClose() { closing = true; },
    settle,
    async dispose({ contextClosed }) {
      if (!contextClosed) throw new Error('Context request protection must remain until the owned context closes');
      closing = true;
      await settle();
      // Do not unroute a live context: releasing its routes could dispatch a
      // paused popup request. Context/browser closure removes the routes.
      state.closed = true;
    },
  };
}
