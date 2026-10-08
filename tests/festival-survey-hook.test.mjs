import assert from "node:assert/strict";
import { test } from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const SESSION_KEY = "fairground-festival-survey-v1";
const loadPure = moduleLoader();
const model = loadPure("src/features/festival-survey/model.ts");
const pendingStorage = loadPure("src/features/festival-survey/pending-storage.ts");

class MemoryStorage {
  values = new Map();
  writes = [];
  removes = [];
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.writes.push([key, value]); this.values.set(key, value); }
  removeItem(key) { this.removes.push(key); this.values.delete(key); }
  clear() { this.values.clear(); }
}

function submission(index = 1, overrides = {}) {
  const parsed = model.parseSurveySubmission({
    responseId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    answers: {
      ...model.createEmptySurveyAnswers(), role: "player", overallSatisfaction: 5,
      recommendation: 0, returnIntent: "probably",
      categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
      rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate",
      bestMoment: "  함께 뛰어서 즐거웠습니다.  ", improvement: "없음", ...overrides,
    },
  });
  assert.ok(parsed.success);
  return parsed.value;
}

function response(status = 200, body = { success: true }) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

/** Runs the real hook and storage code, with local effects and no network. */
function browserFixture(t) {
  const prior = Object.fromEntries(["window", "document", "sessionStorage", "localStorage", "fetch", "crypto"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new MemoryStorage();
  let session = new MemoryStorage();
  const calls = [];
  const timers = new Map();
  let nextTimer = 0;
  let uuidCalls = 0;
  let runtime;
  let fetchHandler = () => Promise.reject(new TypeError("synthetic offline connection"));
  const fakeWindow = new EventTarget();
  fakeWindow.localStorage = local;
  fakeWindow.sessionStorage = session;
  fakeWindow.setTimeout = (callback) => { timers.set(++nextTimer, callback); return nextTimer; };
  fakeWindow.clearTimeout = (id) => timers.delete(id);
  fakeWindow.matchMedia = () => ({ matches: true });
  fakeWindow.scrollTo = () => {};
  function install(key, value) { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  install("window", fakeWindow);
  install("document", { getElementById: () => ({ focus() {}, scrollIntoView() {} }) });
  install("localStorage", local);
  install("sessionStorage", session);
  install("crypto", { randomUUID: () => submission(++uuidCalls).responseId });
  install("fetch", (url, options) => {
    const call = { url, options, envelope: JSON.parse(options.body) };
    calls.push(call);
    return fetchHandler(call);
  });

  function mount() {
    const cells = [];
    const effects = [];
    let cursor = 0;
    let latest;
    const react = {
      useState(initial) {
        const index = cursor++;
        if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
        return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
      },
      useRef(initial) { const index = cursor++; return cells[index] ??= { current: initial }; },
      useEffect(callback, deps) {
        const index = cursor++;
        const previous = cells[index];
        if (!previous || !deps || deps.some((value, position) => !Object.is(value, previous.deps[position]))) {
          effects.push(() => { previous?.cleanup?.(); cells[index] = { deps, cleanup: callback() }; });
        }
      },
      useMemo(callback, deps) {
        const index = cursor++;
        const previous = cells[index];
        if (!previous || !deps || deps.some((value, position) => !Object.is(value, previous.deps[position]))) cells[index] = { deps, value: callback() };
        return cells[index].value;
      },
      useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    };
    const { useSurvey: runHook } = moduleLoader({ react })("src/features/festival-survey/use-survey.ts");
    return {
      render() { cursor = 0; latest = runHook(); while (effects.length) effects.shift()(); return latest; },
      unmount() { cells.forEach((cell) => cell?.cleanup?.()); },
    };
  }

  runtime = mount();
  const render = () => runtime.render();
  async function flush() {
    for (let round = 0; round < 12; round++) {
      await Promise.resolve();
      render();
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    }
    return render();
  }
  function fill(answers = submission().answers) {
    for (const [key, value] of Object.entries(answers)) render().update(key, value);
    return render();
  }
  function reopen({ loseSession = true } = {}) {
    runtime.unmount();
    if (loseSession) {
      session = new MemoryStorage();
      fakeWindow.sessionStorage = session;
      install("sessionStorage", session);
    }
    runtime = mount();
    return render();
  }
  t.after(() => {
    runtime.unmount();
    for (const [key, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    local, calls, fakeWindow, render, flush, fill, reopen,
    get session() { return session; },
    get uuidCalls() { return uuidCalls; },
    setFetch(handler) { fetchHandler = handler; },
    queued() { return pendingStorage.readPendingSubmissions(local); },
    seed(value, createdAt = 1) { local.setItem(pendingStorage.PENDING_STORAGE_PREFIX + value.responseId, JSON.stringify({ version: 1, createdAt, submission: value })); },
  };
}

test("the exact validated packet is durable before fetch and waits for the server receipt", async (t) => {
  const browser = browserFixture(t);
  await browser.flush();
  browser.fill();
  const waiting = deferred();
  browser.setFetch((call) => {
    assert.equal(call.url, "/api/survey");
    assert.equal(call.options.credentials, "omit");
    assert.deepEqual(browser.queued(), [call.envelope]);
    assert.equal(JSON.parse(browser.session.getItem(SESSION_KEY)).pending.responseId, call.envelope.responseId);
    return waiting.promise;
  });
  const sending = browser.render().submit();
  let hook = await browser.flush();
  assert.equal(hook.submitted, false);
  assert.equal(hook.submitting, true);
  assert.deepEqual(hook.pending, browser.calls[0].envelope);
  assert.equal(browser.local.removes.length, 0);
  await hook.submit();
  assert.equal(browser.calls.length, 1, "double clicks cannot create concurrent requests");
  waiting.resolve(response());
  await sending;
  hook = await browser.flush();
  assert.equal(hook.submitted, true);
  assert.equal(hook.pending, null);
  assert.deepEqual(browser.queued(), []);
});

test("a failed request survives tab/session loss and retries the original UUID and payload", async (t) => {
  const browser = browserFixture(t);
  await browser.flush();
  browser.fill();
  await browser.render().submit();
  let hook = await browser.flush();
  const original = browser.calls[0].envelope;
  assert.equal(hook.submitted, false);
  assert.deepEqual(browser.queued(), [original]);
  browser.reopen();
  hook = await browser.flush();
  assert.equal(hook.ready, true);
  assert.equal(hook.submitted, false);
  assert.deepEqual(hook.pending, original);
  assert.deepEqual(hook.answers, original.answers);
  assert.equal(browser.calls.length, 1, "hydration must not silently send a synthetic response");
  browser.setFetch(() => response());
  await hook.submit();
  hook = await browser.flush();
  assert.equal(browser.calls.length, 2);
  assert.equal(browser.calls[1].options.body, browser.calls[0].options.body);
  assert.equal(browser.uuidCalls, 1);
  assert.equal(hook.submitted, true);
  assert.deepEqual(browser.queued(), []);
});

for (const [label, status, body] of [
  ["validation rejection", 422, { success: false, error: "synthetic validation failure" }],
  ["definitive bad request", 400, { success: false }],
  ["payload rejection", 413, { success: false }],
  ["server failure with a misleading success body", 500, { success: true }],
  ["HTTP success without a confirmed receipt", 200, { saved: true }],
]) {
  test(`${label} retains the original pending packet instead of claiming submission`, async (t) => {
    const browser = browserFixture(t);
    await browser.flush();
    browser.fill();
    browser.setFetch(() => response(status, body));
    await browser.render().submit();
    const hook = await browser.flush();
    assert.equal(hook.submitted, false);
    assert.deepEqual(hook.pending, browser.calls[0].envelope);
    assert.deepEqual(browser.queued(), [browser.calls[0].envelope]);
    assert.equal(browser.local.removes.length, 0);
    assert.ok(hook.message);
  });
}

test("blocked durable storage warns that closing the tab can lose the session fallback", async (t) => {
  const browser = browserFixture(t);
  Object.defineProperty(browser.fakeWindow, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  await browser.flush();
  browser.fill();
  await browser.render().submit();
  const hook = await browser.flush();
  assert.equal(hook.submitted, false);
  assert.ok(hook.storageWarning);
  assert.match(hook.storageWarning, /탭.*닫지/);
  assert.ok(JSON.parse(browser.session.getItem(SESSION_KEY)).pending);
  assert.doesNotMatch(hook.message, /자동.*복구|응답.*보관 중|저장.*완료/);
});

test("when both storage types fail, the warning also says not to refresh", async (t) => {
  const browser = browserFixture(t);
  Object.defineProperty(browser.fakeWindow, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
  browser.session.setItem = () => { throw new Error("QuotaExceededError"); };
  await browser.flush();
  browser.fill();
  await browser.render().submit();
  const hook = await browser.flush();
  assert.equal(hook.submitted, false);
  assert.ok(hook.pending, "the current page can still retry its in-memory packet");
  assert.match(hook.storageWarning, /새로고침/);
  assert.match(hook.storageWarning, /탭.*닫지/);
  assert.doesNotMatch(hook.message, /자동.*복구|응답.*보관 중|저장.*완료/);
  assert.equal(browser.session.getItem(SESSION_KEY), null);
});

test("oldest receipt confirmation removes only its own attempt and preserves the remaining queue", async (t) => {
  const browser = browserFixture(t);
  const first = submission(11);
  const second = submission(12, { bestMoment: "두 번째 대기 응답", recommendation: 10 });
  browser.seed(second, 20);
  browser.seed(first, 10);
  browser.local.setItem("fairground-match-recording-v1", "protected unrelated recording queue");
  browser.session.setItem(SESSION_KEY, JSON.stringify({ answers: model.createEmptySurveyAnswers(), pending: null, submitted: true }));
  let hook = await browser.flush();
  assert.deepEqual(hook.pending, first, "a prior tab receipt does not hide unresolved durable attempts");
  assert.equal(hook.submitted, false);
  browser.setFetch(() => response());
  await hook.submit();
  hook = await browser.flush();
  assert.deepEqual(browser.calls[0].envelope, first);
  assert.deepEqual(browser.queued(), [second]);
  assert.deepEqual(hook.pending, second);
  assert.deepEqual(hook.answers, second.answers);
  assert.equal(hook.submitted, false, "the form must offer recovery until its pending queue is empty");
  assert.equal(browser.local.getItem("fairground-match-recording-v1"), "protected unrelated recording queue");
  assert.deepEqual(browser.local.removes, [pendingStorage.PENDING_STORAGE_PREFIX + first.responseId]);
  await hook.submit();
  hook = await browser.flush();
  assert.deepEqual(browser.calls[1].envelope, second);
  assert.equal(hook.submitted, true);
  assert.deepEqual(browser.queued(), []);
  assert.equal(browser.uuidCalls, 0);
});

test("legacy session-only pending packets migrate without changing their UUID or sending automatically", async (t) => {
  const browser = browserFixture(t);
  const legacy = submission(21, { bestMoment: "기존 세션에서 복구" });
  browser.session.setItem(SESSION_KEY, JSON.stringify({ answers: legacy.answers, pending: legacy, submitted: false }));
  let hook = await browser.flush();
  assert.deepEqual(browser.queued(), [legacy]);
  assert.deepEqual(hook.pending, legacy);
  assert.deepEqual(hook.answers, legacy.answers);
  assert.equal(browser.calls.length, 0);
  browser.reopen();
  hook = await browser.flush();
  assert.deepEqual(hook.pending, legacy);
  browser.setFetch(() => response());
  await hook.submit();
  hook = await browser.flush();
  assert.deepEqual(browser.calls[0].envelope, legacy);
  assert.equal(browser.uuidCalls, 0);
  assert.equal(hook.submitted, true);
  assert.deepEqual(browser.queued(), []);
});

test("another tab's durable packet cannot replace an unfinished session draft, and remains recoverable after that draft submits", async (t) => {
  const browser = browserFixture(t);
  const otherTab = submission(31, { bestMoment: "다른 탭의 전송 대기 응답" });
  browser.seed(otherTab, 10);
  const otherKey = pendingStorage.PENDING_STORAGE_PREFIX + otherTab.responseId;
  const originalOtherRecord = browser.local.getItem(otherKey);
  const ownDraft = { ...model.createEmptySurveyAnswers(), role: "captain", bestMoment: "아직 작성 중인 이번 탭의 의견" };
  browser.session.setItem(SESSION_KEY, JSON.stringify({ answers: ownDraft, pending: null, submitted: false }));

  let hook = await browser.flush();
  assert.deepEqual(hook.answers, ownDraft);
  assert.equal(hook.pending, null);
  assert.equal(hook.submitted, false);
  assert.deepEqual(browser.queued(), [otherTab]);
  assert.equal(browser.local.getItem(otherKey), originalOtherRecord);
  assert.equal(browser.calls.length, 0);

  const ownCompletedAnswers = submission(32, { role: "captain", bestMoment: ownDraft.bestMoment, recommendation: 8 }).answers;
  browser.fill(ownCompletedAnswers);
  browser.setFetch(() => response());
  await browser.render().submit();
  hook = await browser.flush();
  assert.deepEqual(browser.calls[0].envelope.answers, ownCompletedAnswers);
  assert.notEqual(browser.calls[0].envelope.responseId, otherTab.responseId);
  assert.deepEqual(browser.queued(), [otherTab]);
  assert.deepEqual(hook.pending, otherTab);
  assert.deepEqual(hook.answers, otherTab.answers);
  assert.equal(hook.submitted, false);
  assert.equal(browser.local.getItem(otherKey), originalOtherRecord);

  await hook.submit();
  hook = await browser.flush();
  assert.deepEqual(browser.calls[1].envelope, otherTab);
  assert.equal(hook.submitted, true);
  assert.deepEqual(browser.queued(), []);
});

test("a server-confirmed receipt stays complete after a same-session refresh even when durable removal is blocked", async (t) => {
  const browser = browserFixture(t);
  await browser.flush();
  browser.fill();
  browser.local.removeItem = () => { throw new Error("SecurityError on receipt cleanup"); };
  browser.setFetch(() => response());
  await browser.render().submit();
  let hook = await browser.flush();
  const confirmed = browser.calls[0].envelope;
  const key = pendingStorage.PENDING_STORAGE_PREFIX + confirmed.responseId;
  const retainedRawRecord = browser.local.getItem(key);
  assert.equal(hook.submitted, true);
  assert.equal(hook.pending, null);
  assert.deepEqual(browser.queued(), [confirmed], "a blocked deletion must preserve the original recovery bytes");

  browser.reopen({ loseSession: false });
  hook = await browser.flush();
  assert.equal(hook.submitted, true);
  assert.equal(hook.pending, null);
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.local.getItem(key), retainedRawRecord);

  browser.reopen();
  hook = await browser.flush();
  assert.deepEqual(hook.pending, confirmed, "a new tab can safely check the retained original UUID with the server");
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.uuidCalls, 1);
});

test("blocked removals cannot cycle two confirmed attempts back into the same session's recovery queue", async (t) => {
  const browser = browserFixture(t);
  const first = submission(41);
  const second = submission(42, { bestMoment: "다음 대기 응답", recommendation: 9 });
  browser.seed(first, 10);
  browser.seed(second, 20);
  const originalRecords = [...browser.local.values];
  browser.local.removeItem = () => { throw new Error("SecurityError on receipt cleanup"); };
  browser.setFetch(() => response());
  let hook = await browser.flush();
  assert.deepEqual(hook.pending, first);

  await hook.submit();
  hook = await browser.flush();
  assert.deepEqual(hook.pending, second);
  assert.equal(hook.submitted, false);
  assert.deepEqual(browser.queued(), [first, second]);
  await hook.submit();
  hook = await browser.flush();
  assert.equal(hook.submitted, true);
  assert.equal(hook.pending, null);
  assert.deepEqual(browser.calls.map((call) => call.envelope), [first, second]);
  assert.deepEqual([...browser.local.values], originalRecords);

  browser.reopen({ loseSession: false });
  hook = await browser.flush();
  assert.equal(hook.submitted, true);
  assert.equal(hook.pending, null);
  assert.equal(browser.calls.length, 2);
  assert.equal(browser.uuidCalls, 0);
  assert.deepEqual([...browser.local.values], originalRecords);
});
