import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  const previous = { indexedDB: globalThis.indexedDB, window: globalThis.window };
  const original = {
    key: "actor:match", actorId: "actor", matchId: "match", revision: 5,
    pending: [{ id: "existing-goal" }], journal: [{ id: "existing-goal" }],
  };
  let stored = structuredClone(original), changes = 0;
  const transactions = [];
  const db = {
    transaction(_store, mode) {
      assert.equal(mode, "readwrite");
      const tx = {
        state: "active", candidate: undefined, abortCalls: 0,
        abort() {
          this.abortCalls++;
          if (this.state !== "active") throw new DOMException("Already complete", "InvalidStateError");
          this.state = "aborted";
          this.candidate = undefined;
          queueMicrotask(() => this.onabort?.());
        },
        commit() {
          assert.equal(this.state, "active");
          assert.ok(this.candidate);
          stored = structuredClone(this.candidate);
          this.state = "committed";
          this.oncomplete?.();
        },
        objectStore() {
          return {
            get() {
              const request = { result: structuredClone(stored) };
              queueMicrotask(() => { if (tx.state === "active") request.onsuccess?.(); });
              return request;
            },
            put(value) {
              assert.equal(tx.state, "active");
              tx.candidate = structuredClone(value);
            },
          };
        },
      };
      transactions.push(tx);
      return tx;
    },
  };
  globalThis.window = { dispatchEvent(event) { assert.equal(event.type, "fg-recording-change"); changes++; } };
  globalThis.indexedDB = {
    open() {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  const { updateRoom } = moduleLoader()("src/features/match-recording/storage.ts");
  return { updateRoom, original, transactions, stored: () => stored, changes: () => changes };
}

test("cancelling preparation after put aborts only its transaction and preserves existing pending records", async t => {
  const f = fixture(t), controller = new AbortController();
  const operation = f.updateRoom(f.original.key, room => ({ ...room, syncedAt: 123 }), controller.signal);
  const rejected = assert.rejects(operation, { name: "AbortError" });
  await flush();
  assert.equal(f.transactions[0].candidate.revision, 6);
  controller.abort();
  await rejected;
  assert.equal(f.transactions[0].state, "aborted");
  assert.deepEqual(f.stored(), f.original);
  assert.equal(f.changes(), 0);
});

test("ordinary user recording without a cancellation signal commits after durability confirmation", async t => {
  const f = fixture(t);
  let resolved = false;
  const operation = f.updateRoom(f.original.key, room => ({ ...room,
    pending: [...room.pending, { id: "new-goal" }], journal: [...room.journal, { id: "new-goal" }],
  })).then(room => { resolved = true; return room; });
  await flush();
  assert.equal(resolved, false);
  assert.deepEqual(f.stored(), f.original);
  f.transactions[0].commit();
  const saved = await operation;
  assert.equal(saved.revision, 6);
  assert.deepEqual(saved.pending.map(command => command.id), ["existing-goal", "new-goal"]);
  assert.deepEqual(saved.journal, saved.pending);
  assert.deepEqual(f.stored(), saved);
  assert.equal(f.changes(), 1);
});

test("cancellation after a completed commit cannot undo it or call abort on the closed transaction", async t => {
  const f = fixture(t), controller = new AbortController();
  const operation = f.updateRoom(f.original.key, room => ({ ...room, syncedAt: 456 }), controller.signal);
  await flush();
  f.transactions[0].commit();
  const saved = await operation;
  controller.abort();
  assert.equal(f.transactions[0].abortCalls, 0);
  assert.deepEqual(f.stored(), saved);
  assert.deepEqual(saved.pending, f.original.pending);
  assert.equal(f.changes(), 1);
});
