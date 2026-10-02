import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const require = createRequire(import.meta.url);
const { RealtimeClient } = require("@supabase/realtime-js");
const sdkVersion = require("@supabase/realtime-js/package.json").version;
const path = "src/features/match-recording/presence-compatibility.ts";
const { protectRecordingPresenceReferences: protect } = moduleLoader()(path);
const meta = (key, revision, pending = 0) => ({
  phx_ref: `${key}-${revision}`, pending, blockingPending: pending, queueRevision: revision,
});
const entry = (key, revision, pending = 0) => ({ [key]: { metas: [meta(key, revision, pending)] } });

function fixture() {
  // Create the installed SDK's complete adapter chain without connecting a socket.
  const client = new RealtimeClient("wss://synthetic.invalid/realtime/v1", { params: { apikey: "synthetic" } });
  const channel = client.channel("match-recording:synthetic");
  const phoenix = channel.presence.presenceAdapter.presence;
  const raw = channel.channelAdapter.getChannel();
  raw.joinPush.ref = "join-1";
  const events = [];
  channel.on("presence", { event: "*" }, payload => events.push(payload));
  assert.equal(protect(channel), true);
  return {
    client, channel, phoenix, raw, events,
    state: value => raw.trigger("presence_state", structuredClone(value)),
    diff: (joins, leaves = {}) => raw.trigger("presence_diff", structuredClone({ joins, leaves })),
  };
}

test("installed SDK joins, repeated updates, and leaves keep live references and public payloads intact", () => {
  assert.equal(sdkVersion, "2.105.4", "Review the scoped compatibility layer when upgrading the SDK");
  const f = fixture();
  f.state({ ...entry("04", 1), ...entry("05", 1) });
  assert.deepEqual(Object.keys(f.channel.presenceState()), ["04", "05"]);
  for (const [index, pending] of [1, 2, 1, 0].entries()) {
    const revision = index + 2;
    f.diff(entry("04", revision, pending), entry("04", revision - 1));
    assert.deepEqual(f.phoenix.state["04"].metas, [meta("04", revision, pending)]);
    assert.deepEqual(f.channel.presenceState()["04"], [{
      pending, blockingPending: pending, queueRevision: revision, presence_ref: `04-${revision}`,
    }]);
  }
  f.diff({}, entry("04", 5));
  assert.deepEqual(Object.keys(f.channel.presenceState()), ["05"]);
  assert.equal(f.phoenix.state["05"].metas[0].phx_ref, "05-1");
  f.diff(entry("04", 6, 1));
  assert.equal(f.phoenix.state["04"].metas[0].phx_ref, "04-6");

  const changes = f.events.filter(event => event.event !== "sync");
  assert.ok(changes.some(event => event.event === "leave" && event.key === "04"));
  for (const event of changes) {
    for (const row of [...event.currentPresences, ...(event.newPresences ?? event.leftPresences)]) {
      assert.equal(typeof row.presence_ref, "string");
      assert.equal("phx_ref" in row, false);
    }
  }
});

test("installed SDK full-state reconciliation drains buffered rejoin diffs and removes only departed peers", () => {
  const f = fixture();
  f.state({ ...entry("04", 1, 1), ...entry("05", 1) });
  f.diff(entry("04", 2, 0), entry("04", 1));
  f.raw.joinPush.ref = "join-2";
  f.diff(entry("05", 2, 1), entry("05", 1));
  assert.equal(f.phoenix.pendingDiffs.length, 1);
  f.state({ ...entry("04", 2), ...entry("05", 1) });
  assert.equal(f.phoenix.joinRef, "join-2");
  assert.equal(f.phoenix.pendingDiffs.length, 0);
  assert.deepEqual(f.phoenix.state["05"].metas, [meta("05", 2, 1)]);
  f.state(entry("05", 2, 1));
  assert.deepEqual(Object.keys(f.channel.presenceState()), ["05"]);
  assert.deepEqual(f.phoenix.state["05"].metas, [meta("05", 2, 1)]);
  f.state({});
  assert.deepEqual(f.channel.presenceState(), {});
});

test("compatibility is idempotent across module reloads and only changes the selected channel", () => {
  const f = fixture();
  const { onJoin, onLeave, onSync } = f.phoenix.caller;
  const other = f.client.channel("unrelated-channel");
  const originalOtherJoin = other.presence.presenceAdapter.presence.caller.onJoin;
  const reloaded = moduleLoader()(path).protectRecordingPresenceReferences;
  assert.equal(protect(f.channel), true);
  assert.equal(reloaded(f.channel), true);
  assert.equal(f.phoenix.caller.onJoin, onJoin);
  assert.equal(f.phoenix.caller.onLeave, onLeave);
  assert.equal(f.phoenix.caller.onSync, onSync);
  assert.equal(other.presence.presenceAdapter.presence.caller.onJoin, originalOtherJoin);
});

test("compatibility preserves callback receiver and return while isolating nested input metadata", () => {
  const receiver = {};
  const callback = function (key, current, changed) {
    assert.equal(this, receiver);
    assert.equal(key, "peer");
    current.metas[0].nested.value = "changed";
    delete changed.metas[0].phx_ref;
    return "original-result";
  };
  const phoenix = {
    caller: { onJoin: callback, onLeave: callback },
    onJoin(value) { assert.equal(this, phoenix); this.caller.onJoin = value; },
    onLeave(value) { assert.equal(this, phoenix); this.caller.onLeave = value; },
  };
  assert.equal(protect({ presence: { presenceAdapter: { presence: phoenix } } }), true);
  for (const method of ["onJoin", "onLeave"]) {
    const current = { metas: [{ nested: { value: "original" } }] };
    const changed = { metas: [{ phx_ref: "still-live" }] };
    assert.equal(phoenix.caller[method].call(receiver, "peer", current, changed), "original-result");
    assert.equal(current.metas[0].nested.value, "original");
    assert.equal(changed.metas[0].phx_ref, "still-live");
  }
});

test("unsupported SDK versions and adapter layouts are left untouched", () => {
  const future = moduleLoader({ "@supabase/realtime-js/package.json": { version: "2.105.5" } })(path);
  const f = fixture();
  const original = f.phoenix.caller.onJoin;
  assert.equal(future.protectRecordingPresenceReferences(f.channel), false);
  assert.equal(f.phoenix.caller.onJoin, original);
  for (const unsupported of [null, {}, { presence: {} }, { presence: { presenceAdapter: { presence: { caller: {} } } } }]) {
    assert.equal(protect(unsupported), false);
  }
});
