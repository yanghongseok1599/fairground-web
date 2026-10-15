import { randomUUID } from "node:crypto";
import { validatePreviewUrl } from "./config.mjs";

// This opt-in guard never enumerates or changes other installed extensions.
export const KNOWN_EXTENSION_ID = "fahhlhbhnmkjegdfoiadmnhcclidoflh";
const CONTROL_URL = `chrome://extensions/?id=${KNOWN_EXTENSION_ID}`;
const PHASES = new Set([
  "prepared", "disable-attempted", "isolated", "restore-attempted", "restored", "unchanged", "untouched",
]);
const RECEIPT_KEYS = [
  "version", "extensionId", "operationId", "space", "controlPage", "previewOrigin", "originalEnabled", "phase", "controlPageClosed",
];
const OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateIdentity(info) {
  if (
    !info || info.id !== KNOWN_EXTENSION_ID || info.type !== "extension" ||
    typeof info.enabled !== "boolean" || typeof info.name !== "string" || !/\b(?:ai|ali)price\b/i.test(info.name)
  ) throw new Error("Known interference extension identity did not match; no extension change is allowed.");
  return info;
}

// The callbacks are self-contained because Ego serializes them into the Page.
async function getExtension(page) {
  return validateIdentity(await page.evaluate((id) => {
    if (location.protocol !== "chrome:" || location.hostname !== "extensions") {
      throw new Error("Extension control Page changed origin.");
    }
    if (typeof chrome?.management?.get !== "function" || typeof chrome?.management?.setEnabled !== "function") {
      throw new Error("Extension management API is unavailable.");
    }
    return new Promise((resolve, reject) => {
      chrome.management.get(id, (info) => {
        if (chrome.runtime.lastError || !info) {
          reject(new Error("Could not read the known interference extension; no extension inventory was requested."));
          return;
        }
        resolve({ id: info.id, name: info.name, type: info.type, enabled: info.enabled });
      });
    });
  }, KNOWN_EXTENSION_ID));
}

async function runOperation(page, state, action) {
  await page.evaluate(async ({ id, operationId, originalEnabled, action: mode, allowMissing }) => {
    if (location.protocol !== "chrome:" || location.hostname !== "extensions") {
      throw new Error("Extension control Page changed origin.");
    }
    if (typeof chrome?.management?.setEnabled !== "function") {
      throw new Error("Extension management API is unavailable.");
    }
    // This registry belongs only to the guard-created chrome://extensions Page.
    // A cancelled entry is never replaced, even by a delayed initialization.
    const key = "__fairgroundExtensionIsolationV1";
    let operation = globalThis[key];
    if (!operation) {
      if (mode !== "initialize" && !(mode === "cancel" && allowMissing)) {
        throw new Error("Extension operation registry is missing; restoration is unconfirmed.");
      }
      operation = {
        id, operationId, originalEnabled, cancelled: mode === "cancel",
        disablePending: null, enablePending: null,
      };
      globalThis[key] = operation;
    }
    if (operation.id !== id || operation.operationId !== operationId || operation.originalEnabled !== originalEnabled) {
      throw new Error("Extension operation token does not match its control Page.");
    }
    if (mode === "initialize") return;
    if (mode === "cancel") {
      // Set this synchronously, BEFORE awaiting. A disable evaluation which
      // starts late is rejected; one already dispatched must finish its Chrome
      // callback before the caller may read back, restore, or close this Page.
      operation.cancelled = true;
      await Promise.all([operation.disablePending?.promise, operation.enablePending?.promise].filter(Boolean));
      return;
    }
    if (mode !== "disable" && mode !== "enable") throw new Error("Unknown extension operation.");
    if (!originalEnabled) throw new Error("An originally disabled extension must not be changed.");
    if (mode === "disable" && operation.cancelled) throw new Error("Extension disable was cancelled before dispatch.");
    if (mode === "enable" && !operation.cancelled) throw new Error("Extension restoration requires a cancellation barrier.");
    const pendingKey = mode === "disable" ? "disablePending" : "enablePending";
    let pending = operation[pendingKey];
    if (mode === "disable" && pending) throw new Error("Extension disable was already dispatched; no retry is allowed.");
    if (!pending || pending.settled) {
      let finish;
      pending = { settled: false, promise: new Promise((resolve) => { finish = resolve; }) };
      // Register the pending callback BEFORE dispatch, including synchronous
      // callback/error paths. It always fulfills, avoiding an orphaned rejection
      // if the automation wrapper has already timed out.
      operation[pendingKey] = pending;
      const complete = (failed) => {
        pending.settled = true;
        finish({ failed });
      };
      try {
        chrome.management.setEnabled(id, mode === "enable", () => complete(Boolean(chrome.runtime.lastError)));
      } catch {
        complete(true);
      }
    }
    const result = await pending.promise;
    if (result.failed) throw new Error("Could not update the known interference extension.");
  }, {
    id: KNOWN_EXTENSION_ID, operationId: state.operationId, originalEnabled: state.originalEnabled, action,
    allowMissing: ["prepared", "restored", "unchanged", "untouched"].includes(state.phase),
  });
}

function validateReceipt(receipt, task) {
  if (
    !receipt || typeof receipt !== "object" || Array.isArray(receipt) ||
    Object.keys(receipt).length !== RECEIPT_KEYS.length || RECEIPT_KEYS.some((key) => !Object.hasOwn(receipt, key)) ||
    receipt.version !== 1 || receipt.extensionId !== KNOWN_EXTENSION_ID ||
    typeof receipt.operationId !== "string" || !OPERATION_ID.test(receipt.operationId) ||
    !Number.isSafeInteger(receipt.space) || receipt.space < 1 || receipt.space !== task.spaceId ||
    typeof receipt.controlPage !== "string" || !/^p[1-9]\d*$/.test(receipt.controlPage) ||
    typeof receipt.originalEnabled !== "boolean" || !PHASES.has(receipt.phase) ||
    typeof receipt.controlPageClosed !== "boolean"
  ) throw new Error("Invalid extension isolation receipt; refusing restoration.");
  if (validatePreviewUrl(receipt.previewOrigin) !== receipt.previewOrigin) {
    throw new Error("Invalid extension isolation Preview origin.");
  }
  if (!receipt.originalEnabled && !["prepared", "unchanged"].includes(receipt.phase)) {
    throw new Error("An originally disabled extension must never be enabled by restoration.");
  }
  if (receipt.originalEnabled && receipt.phase === "unchanged") {
    throw new Error("Invalid enabled-extension isolation receipt.");
  }
  if (receipt.controlPageClosed && !["restored", "unchanged", "untouched"].includes(receipt.phase)) {
    throw new Error("Extension control Page cannot be closed before restoration is confirmed.");
  }
  return { ...receipt };
}

async function publish(receipt, changes, writeReceipt) {
  await writeReceipt({ ...receipt, ...changes });
  Object.assign(receipt, changes);
}

/** Restore only the one extension recorded by this opt-in guard, in the same TaskSpace. */
export async function restoreExtensionIsolation({ task, receipt, writeReceipt }) {
  if (typeof writeReceipt !== "function") throw new Error("Extension isolation requires a durable receipt writer.");
  const state = validateReceipt(receipt, task);
  if (state.controlPageClosed) return state;
  const terminalPhase = ["restored", "unchanged", "untouched"].includes(state.phase);
  const pages = await task.pages();
  if (!pages.some((candidate) => candidate.label === state.controlPage)) {
    if (!terminalPhase) throw new Error("Extension restoration is unconfirmed and its control Page is missing; no new Page or retry was attempted.");
    // Closing can succeed just before a child exits or the last journal write
    // fails. A terminal phase already proves restoration/no mutation, so only
    // complete the journal after confirming that this control Page is absent.
    await publish(state, { controlPageClosed: true }, writeReceipt);
    return state;
  }
  const page = task.page(state.controlPage);
  if (page.label !== state.controlPage || page.spaceId !== state.space) {
    throw new Error("Extension control Page does not belong to the recorded TaskSpace.");
  }

  await runOperation(page, state, "cancel");

  if (["disable-attempted", "isolated", "restore-attempted"].includes(state.phase)) {
    const current = await getExtension(page);
    // The write-ahead phase also covers a lost/failed disable callback. Read back
    // before restoring so a second recovery never repeats an unnecessary write.
    if (!current.enabled) {
      await publish(state, { phase: "restore-attempted" }, writeReceipt);
      await runOperation(page, state, "enable");
    }
    if (!(await getExtension(page)).enabled) {
      throw new Error("Known interference extension restoration was not confirmed; keep its control Page open.");
    }
    await publish(state, { phase: "restored" }, writeReceipt);
  } else if (state.phase === "prepared") {
    // No disable was dispatched. Preserve any concurrent user change.
    await publish(state, { phase: state.originalEnabled ? "untouched" : "unchanged" }, writeReceipt);
  }

  // Only this guard's newly created control Page is closed, never the app Page.
  await page.evaluate(() => {
    if (location.protocol !== "chrome:" || location.hostname !== "extensions") {
      throw new Error("Extension control Page changed origin; refusing to close it.");
    }
  });
  await page.close();
  await publish(state, { controlPageClosed: true }, writeReceipt);
  return state;
}

/** Temporarily isolate the known image-search extension; opt-in is mandatory. */
export async function beginExtensionIsolation({ task, config, writeReceipt }) {
  if (config.isolateExtension == null) return { receipt: null, restore: async () => null };
  if (config.isolateExtension !== "aliprice") throw new Error("Only the known AliPrice interference extension may be isolated.");
  if (typeof writeReceipt !== "function") throw new Error("Extension isolation requires a durable receipt writer.");
  const previewOrigin = validatePreviewUrl(config.url);
  if (!Number.isSafeInteger(task.spaceId) || task.spaceId !== config.space) {
    throw new Error("Extension isolation requires the already verified Preview TaskSpace.");
  }
  const page = await task.newPage();
  if (!/^p[1-9]\d*$/.test(page.label) || page.spaceId !== task.spaceId || page.label === config.page) {
    throw new Error("Extension isolation requires a separate managed control Page.");
  }
  let state;
  try {
    await page.goto(CONTROL_URL);
    const info = await getExtension(page);
    state = {
      version: 1, extensionId: KNOWN_EXTENSION_ID, operationId: randomUUID(), space: task.spaceId,
      controlPage: page.label, previewOrigin, originalEnabled: info.enabled,
      phase: "prepared", controlPageClosed: false,
    };
    await publish(state, {}, writeReceipt);
    await runOperation(page, state, "initialize");
    if (info.enabled) {
      // Journal the possible mutation BEFORE dispatch. The parent runner can
      // recover this exact state after an interrupted child or hard timeout.
      await publish(state, { phase: "disable-attempted" }, writeReceipt);
      await runOperation(page, state, "disable");
      if ((await getExtension(page)).enabled) throw new Error("Known interference extension is still enabled; isolation failed.");
      await publish(state, { phase: "isolated" }, writeReceipt);
    } else await publish(state, { phase: "unchanged" }, writeReceipt);
  } catch (error) {
    try {
      if (state) state = await restoreExtensionIsolation({ task, receipt: state, writeReceipt });
      else await page.close(); // No mutation could have been dispatched.
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], "Extension isolation failed and restoration is unconfirmed; inspect the durable receipt and existing TaskSpace.");
    }
    throw error;
  }
  return {
    get receipt() { return { ...state }; },
    async restore() {
      state = await restoreExtensionIsolation({ task, receipt: state, writeReceipt });
      return { ...state };
    },
  };
}
