import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  beginExtensionIsolation, KNOWN_EXTENSION_ID, restoreExtensionIsolation,
} from "../scripts/testing/browser/extensions.mjs";

const config = {
  url: "https://fairground-7idyy4r9g-milestones-projects-d52c4dda.vercel.app",
  space: 85, page: "p1", isolateExtension: "aliprice",
};

function fixture(options = {}) {
  const info = {
    id: KNOWN_EXTENSION_ID, type: "extension", name: "AiPrice(AliPrice) — TB image search",
    enabled: options.enabled ?? true, ...options.info,
  };
  const receipts = [];
  const events = [];
  const calls = [];
  let closeCount = 0;
  let restoreError = options.restoreError ?? false;
  let completePendingDisable;
  const runtime = { lastError: undefined };
  function callbackWithError(callback, message, result) {
    runtime.lastError = message ? { message } : undefined;
    callback(result);
    runtime.lastError = undefined;
  }
  const context = {
    location: { protocol: "chrome:", hostname: "extensions" },
    chrome: {
      runtime,
      management: {
        get(id, callback) {
          assert.equal(id, KNOWN_EXTENSION_ID);
          events.push("read");
          callbackWithError(callback, options.absent ? "Not found" : null, options.absent ? undefined : { ...info });
        },
        setEnabled(id, enabled, callback) {
          assert.equal(id, KNOWN_EXTENSION_ID);
          calls.push(enabled);
          events.push(`set:${enabled}`);
          if (enabled && restoreError) {
            callbackWithError(callback, "Restore rejected");
            return;
          }
          if (!enabled && options.disableErrorBeforeMutation) {
            callbackWithError(callback, "Disable rejected");
            return;
          }
          if (!enabled && options.deferDisableCallback) {
            completePendingDisable = () => {
              info.enabled = false;
              callbackWithError(callback, null);
              completePendingDisable = undefined;
            };
            return;
          }
          if (!(options.ignoreDisable && !enabled)) info.enabled = enabled;
          callbackWithError(callback, !enabled && options.disableErrorAfterMutation ? "Callback lost" : null);
        },
      },
    },
  };
  const page = {
    label: "p2", spaceId: 85,
    async goto(url) { assert.equal(url, `chrome://extensions/?id=${KNOWN_EXTENSION_ID}`); },
    async evaluate(fn, argument) {
      // Running the serialized function verifies that it does not capture Node
      // state and that the actual Chrome callback/getter path is exercised.
      return vm.runInNewContext(`(${fn.toString()})(${JSON.stringify(argument)})`, context);
    },
    async close() { closeCount += 1; events.push("close"); },
  };
  const task = {
    spaceId: 85,
    async newPage() { events.push("new-page"); return page; },
    async pages() { events.push("pages"); return closeCount ? [] : [page]; },
    page(label) { assert.equal(label, "p2"); return page; },
  };
  const writeReceipt = async (receipt) => {
    events.push(`journal:${receipt.phase}:${receipt.controlPageClosed}`);
    receipts.push(structuredClone(receipt));
  };
  return {
    info, task, page, receipts, events, calls, writeReceipt, context,
    get closeCount() { return closeCount; },
    allowRestore() { restoreError = false; },
    completeDisable() {
      assert.equal(typeof completePendingDisable, "function");
      completePendingDisable();
    },
    async begin(override = {}) { return beginExtensionIsolation({ task, config: { ...config, ...override }, writeReceipt }); },
  };
}

test("extension isolation requires an explicit named opt-in", async () => {
  const f = fixture();
  const guard = await f.begin({ isolateExtension: undefined });
  assert.equal(guard.receipt, null);
  assert.equal(await guard.restore(), null);
  assert.deepEqual(f.events, []);
  await assert.rejects(f.begin({ isolateExtension: "any-other-extension" }), /Only the known/);
  assert.deepEqual(f.events, []);
});

test("an enabled known extension is journaled, isolated, restored and closed exactly once", async () => {
  const f = fixture();
  const guard = await f.begin();
  assert.equal(f.info.enabled, false);
  assert.deepEqual(f.calls, [false]);
  assert.equal(guard.receipt.phase, "isolated");
  assert.ok(f.events.indexOf("journal:disable-attempted:false") < f.events.indexOf("set:false"));
  const receipt = await guard.restore();
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, [false, true]);
  assert.equal(receipt.phase, "restored");
  assert.equal(receipt.controlPageClosed, true);
  assert.equal(f.closeCount, 1);
  assert.ok(f.events.indexOf("journal:restored:false") < f.events.indexOf("close"));
  assert.deepEqual(await guard.restore(), receipt);
  assert.equal(f.closeCount, 1);
  assert.deepEqual(f.calls, [false, true]);
  assert.ok(f.receipts.every((entry) => !JSON.stringify(entry).includes("TB image search")));
});

test("an originally disabled extension is never enabled", async () => {
  const f = fixture({ enabled: false });
  const guard = await f.begin();
  assert.equal(guard.receipt.phase, "unchanged");
  await guard.restore();
  assert.equal(f.info.enabled, false);
  assert.deepEqual(f.calls, []);
  assert.equal(f.closeCount, 1);
});

test("an absent extension fails explicitly without writes or changing any other extension", async () => {
  const f = fixture({ absent: true });
  await assert.rejects(f.begin(), /Could not read/);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.receipts, []);
  assert.equal(f.closeCount, 1);
});

test("id, type and name mismatches all prevent mutation", async () => {
  for (const info of [
    { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { type: "theme" }, { name: "Unrelated image extension" },
  ]) {
    const f = fixture({ info });
    await assert.rejects(f.begin(), /identity did not match/);
    assert.deepEqual(f.calls, []);
    assert.equal(f.closeCount, 1);
  }
});

test("a failed disable callback after mutation still restores the original state", async () => {
  const f = fixture({ disableErrorAfterMutation: true });
  await assert.rejects(f.begin(), /Could not update/);
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, [false, true]);
  assert.equal(f.receipts.at(-1).phase, "restored");
  assert.equal(f.closeCount, 1);
});

test("a failed disable before mutation and an ignored disable do not add enable writes", async () => {
  for (const options of [{ disableErrorBeforeMutation: true }, { ignoreDisable: true }]) {
    const f = fixture(options);
    await assert.rejects(f.begin(), /Could not update|still enabled/);
    assert.equal(f.info.enabled, true);
    assert.deepEqual(f.calls, [false]);
    assert.equal(f.receipts.at(-1).phase, "restored");
  }
});

test("an interrupted child can be recovered from its durable write-ahead receipt", async () => {
  const f = fixture();
  await f.begin();
  // A process interruption can leave only the pre-mutation journal persisted.
  const receipt = f.receipts.find((entry) => entry.phase === "disable-attempted");
  const restored = await restoreExtensionIsolation({ task: f.task, receipt, writeReceipt: f.writeReceipt });
  assert.equal(f.info.enabled, true);
  assert.equal(restored.phase, "restored");
  assert.equal(restored.controlPageClosed, true);
  const count = f.events.length;
  assert.deepEqual(await restoreExtensionIsolation({ task: f.task, receipt: restored, writeReceipt: f.writeReceipt }), restored);
  assert.equal(f.events.length, count);
});

test("a restore failure is visible, keeps the control Page and permits explicit recovery", async () => {
  const f = fixture({ restoreError: true });
  const guard = await f.begin();
  await assert.rejects(guard.restore(), /Could not update/);
  assert.equal(f.info.enabled, false);
  assert.equal(f.closeCount, 0);
  assert.equal(f.receipts.at(-1).phase, "restore-attempted");
  f.allowRestore();
  const restored = await restoreExtensionIsolation({ task: f.task, receipt: f.receipts.at(-1), writeReceipt: f.writeReceipt });
  assert.equal(f.info.enabled, true);
  assert.equal(restored.phase, "restored");
  assert.equal(f.closeCount, 1);
});

test("a combined isolation and restoration failure does not hide either failure", async () => {
  const f = fixture({ disableErrorAfterMutation: true, restoreError: true });
  await assert.rejects(f.begin(), (error) => {
    assert.equal(error.name, "AggregateError");
    assert.equal(error.errors.length, 2);
    return /restoration is unconfirmed/.test(error.message);
  });
  assert.equal(f.info.enabled, false);
  assert.equal(f.closeCount, 0);
  assert.equal(f.receipts.at(-1).phase, "restore-attempted");
});

test("modified or foreign receipts are rejected without touching browser state", async () => {
  const f = fixture();
  const guard = await f.begin();
  const valid = guard.receipt;
  const changes = [
    { extensionId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, { version: 2 }, { space: 86 },
    { operationId: undefined }, { operationId: "not-a-uuid" },
    { previewOrigin: "https://fairground.co.kr" }, { previewOrigin: `${config.url}/` },
    { controlPage: "user-tab" }, { originalEnabled: "true" }, { phase: "anything" },
    { phase: "isolated", originalEnabled: false }, { phase: "unchanged" },
    { controlPageClosed: true }, { unrelated: "field" },
  ];
  const previousEvents = f.events.length;
  for (const change of changes) {
    await assert.rejects(restoreExtensionIsolation({ task: f.task, receipt: { ...valid, ...change }, writeReceipt: f.writeReceipt }));
  }
  assert.equal(f.events.length, previousEvents);
  assert.deepEqual(f.calls, [false]);
  await guard.restore();
});

test("isolation rejects production origins, another TaskSpace and the app Page", async () => {
  for (const override of [{ url: "https://fairground.co.kr" }, { space: 86 }]) {
    const f = fixture();
    await assert.rejects(f.begin(override));
    assert.deepEqual(f.events, []);
  }
  const f = fixture();
  f.page.label = "p1";
  await assert.rejects(f.begin(), /separate managed control Page/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.closeCount, 0);
});

test("a changed control Page origin prevents both extension reads and writes", async () => {
  const f = fixture();
  const guard = await f.begin();
  f.context.location = { protocol: "https:", hostname: "example.com" };
  await assert.rejects(guard.restore(), /changed origin/);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.closeCount, 0);
  f.context.location = { protocol: "chrome:", hostname: "extensions" };
  await guard.restore();
});

test("a failing write-ahead journal prevents any disable request", async () => {
  const f = fixture();
  const writeReceipt = async (receipt) => {
    if (receipt.phase === "disable-attempted") throw new Error("Journal unavailable");
    await f.writeReceipt(receipt);
  };
  await assert.rejects(beginExtensionIsolation({ task: f.task, config, writeReceipt }), /Journal unavailable/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.info.enabled, true);
});

test("a closed control Page is recovered after its final journal write was interrupted", async () => {
  const f = fixture();
  const writeReceipt = async (receipt) => {
    if (receipt.controlPageClosed) throw new Error("Final journal interrupted");
    await f.writeReceipt(receipt);
  };
  const guard = await beginExtensionIsolation({ task: f.task, config, writeReceipt });
  await assert.rejects(guard.restore(), /Final journal interrupted/);
  assert.equal(f.info.enabled, true);
  assert.equal(f.closeCount, 1);
  assert.equal(f.receipts.at(-1).phase, "restored");
  assert.equal(f.receipts.at(-1).controlPageClosed, false);
  const receipt = await restoreExtensionIsolation({ task: f.task, receipt: f.receipts.at(-1), writeReceipt: f.writeReceipt });
  assert.equal(receipt.controlPageClosed, true);
  assert.equal(f.closeCount, 1);
  assert.deepEqual(f.calls, [false, true]);
});

test("a missing control Page before confirmed restoration fails without creating another Page", async () => {
  const f = fixture();
  const guard = await f.begin();
  f.task.pages = async () => [];
  await assert.rejects(guard.restore(), /restoration is unconfirmed.*control Page is missing/);
  assert.equal(f.events.filter((event) => event === "new-page").length, 1);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.closeCount, 0);
});

test("a different valid operation token cannot restore another isolation run", async () => {
  const f = fixture();
  const guard = await f.begin();
  const receipt = { ...guard.receipt, operationId: "12345678-1234-4234-8234-123456789abc" };
  await assert.rejects(restoreExtensionIsolation({ task: f.task, receipt, writeReceipt: f.writeReceipt }), /token does not match/);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.closeCount, 0);
  assert.equal(f.receipts.at(-1).phase, "isolated");
  await guard.restore();
});

test("a timed-out disable evaluation which starts after recovery cannot dispatch", async () => {
  const f = fixture();
  const evaluate = f.page.evaluate.bind(f.page);
  let lateDisable;
  f.page.evaluate = async (fn, argument) => {
    if (argument?.action === "disable") {
      lateDisable = () => evaluate(fn, argument);
      throw new Error("Evaluation timed out with mayHaveLateEffects");
    }
    return evaluate(fn, argument);
  };
  await assert.rejects(f.begin(), /mayHaveLateEffects/);
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, []);
  assert.equal(f.receipts.at(-1).phase, "restored");
  assert.equal(f.closeCount, 1);
  // Keep the mock context alive deliberately: even without relying on tab close
  // destroying it, a late Page evaluation must be unable to disable anything.
  await assert.rejects(lateDisable(), /cancelled before dispatch/);
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, []);
});

test("recovery waits for an already dispatched disable callback before reading or restoring", async () => {
  const f = fixture({ deferDisableCallback: true });
  const evaluate = f.page.evaluate.bind(f.page);
  f.page.evaluate = async (fn, argument) => {
    const result = evaluate(fn, argument);
    if (argument?.action === "disable") {
      result.catch(() => {});
      throw new Error("Evaluation timed out with mayHaveLateEffects");
    }
    return result;
  };
  let completed = false;
  const outcome = f.begin().then(
    () => { completed = true; return null; },
    (error) => { completed = true; return error; },
  );
  await new Promise(setImmediate);
  assert.equal(completed, false);
  assert.equal(f.info.enabled, true); // The Chrome command has not taken effect yet.
  assert.equal(f.events.filter((event) => event === "read").length, 1);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.receipts.at(-1).phase, "disable-attempted");
  assert.equal(f.closeCount, 0);
  f.completeDisable(); // The callback applies its late false before recovery proceeds.
  assert.match((await outcome).message, /mayHaveLateEffects/);
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, [false, true]);
  assert.equal(f.receipts.at(-1).phase, "restored");
  assert.equal(f.closeCount, 1);
});

test("a timed-out cancellation barrier keeps restoration unconfirmed until explicit recovery", async () => {
  const f = fixture({ deferDisableCallback: true });
  const evaluate = f.page.evaluate.bind(f.page);
  f.page.evaluate = async (fn, argument) => {
    const result = evaluate(fn, argument);
    if (["disable", "cancel"].includes(argument?.action)) {
      result.catch(() => {});
      throw new Error("Pending Chrome callback timed out");
    }
    return result;
  };
  await assert.rejects(f.begin(), /restoration is unconfirmed/);
  assert.equal(f.info.enabled, true);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.receipts.at(-1).phase, "disable-attempted");
  assert.equal(f.closeCount, 0);
  f.completeDisable();
  assert.equal(f.info.enabled, false);
  f.page.evaluate = evaluate;
  const result = await restoreExtensionIsolation({ task: f.task, receipt: f.receipts.at(-1), writeReceipt: f.writeReceipt });
  assert.equal(f.info.enabled, true);
  assert.equal(result.phase, "restored");
  assert.equal(result.controlPageClosed, true);
  assert.deepEqual(f.calls, [false, true]);
});

test("a late initialization preserves a prepared-phase cancellation tombstone", async () => {
  const f = fixture();
  const evaluate = f.page.evaluate.bind(f.page);
  let lateInitialize;
  let lateDisable;
  f.page.evaluate = async (fn, argument) => {
    if (argument?.action === "initialize") {
      lateInitialize = () => evaluate(fn, argument);
      lateDisable = () => evaluate(fn, { ...argument, action: "disable" });
      throw new Error("Initialization timed out");
    }
    return evaluate(fn, argument);
  };
  await assert.rejects(f.begin(), /Initialization timed out/);
  assert.equal(f.receipts.at(-1).phase, "untouched");
  assert.equal(f.closeCount, 1);
  await lateInitialize();
  await assert.rejects(lateDisable(), /cancelled before dispatch/);
  assert.deepEqual(f.calls, []);
  assert.equal(f.info.enabled, true);
});

test("a lost mutation registry fails closed without a new extension write", async () => {
  const f = fixture();
  const guard = await f.begin();
  await f.page.evaluate(() => { delete globalThis.__fairgroundExtensionIsolationV1; });
  await assert.rejects(guard.restore(), /registry is missing/);
  assert.deepEqual(f.calls, [false]);
  assert.equal(f.closeCount, 0);
  assert.equal(f.receipts.at(-1).phase, "isolated");
});
