import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

function fixture(t) {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const active = new Map(), created = [], removals = [];
  const supabase = {
    channel(topic, config) {
      if (active.has(topic)) return active.get(topic); // Installed Supabase's same-topic reuse.
      const channel = {
        topic, config, state: "closed", subscriptions: 0, tracks: [], handlers: [],
        on(type, filter, callback) { this.handlers.push({ type, filter, callback }); return this; },
        subscribe(callback) { this.subscriptions++; this.status = callback; this.state = "joined"; callback("SUBSCRIBED"); return this; },
        presenceState: () => ({}),
        async track(value) { this.tracks.push(value); },
      };
      active.set(topic, channel); created.push(channel); return channel;
    },
    removeChannel(channel) {
      channel.state = "leaving";
      return new Promise(resolve => removals.push(() => {
        if (active.get(channel.topic) === channel) active.delete(channel.topic);
        channel.state = "closed";
        channel.status("CLOSED");
        resolve("ok");
      }));
    },
  };
  const { joinRecordingChannel } = moduleLoader({ "@/config/supabase": { supabase } })("src/features/match-recording/shared-channel.ts");
  const join = (deviceId, matchId = "match") => {
    const states = []; let refreshes = 0;
    const handle = joinRecordingChannel({ actorId: "actor", deviceId, matchId, name: deviceId, onState: state => states.push(state), refresh: () => { refreshes++; } });
    return { handle, states, refreshes: () => refreshes };
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return { join, created, removals, active, flush };
}

test("same-match rejoin waits for slow removal and publishes the latest buffered pending counts", async t => {
  const f = fixture(t);
  const a = f.join("device-a");
  const old = f.created[0];
  a.handle.close();
  const b = f.join("device-b");
  b.handle.setPending(4, 3);
  b.handle.setPending(3, 2);
  await f.flush();
  assert.equal(f.created.length, 1);
  assert.equal(old.subscriptions, 1); // No subscription can be attached to the departing channel.
  assert.equal(b.states.some(state => state.connected), false);
  f.removals.shift()();
  await f.flush();
  assert.equal(f.created.length, 2);
  const current = f.active.get("match-recording:match");
  assert.notEqual(current, old);
  assert.equal(current.config.config.presence.key, "actor:device-b");
  assert.deepEqual(current.tracks.at(-1), { name: "device-b", pending: 3, blockingPending: 2 });
  assert.equal(b.states.at(-1).connected, true);
  assert.equal(a.refreshes(), 1); // Late callbacks from the closed provider do not run.
  b.handle.close();
});

test("cancelled waiting provider never joins after removal, while its replacement can join", async t => {
  const f = fixture(t);
  const a = f.join("device-a");
  a.handle.close();
  const cancelled = f.join("device-b");
  cancelled.handle.setPending(9, 9);
  cancelled.handle.close();
  cancelled.handle.close();
  const current = f.join("device-c");
  await f.flush();
  assert.equal(f.removals.length, 1);
  f.removals.shift()();
  await f.flush();
  assert.equal(f.created.length, 2);
  assert.equal(f.created[1].config.config.presence.key, "actor:device-c");
  assert.equal(cancelled.refreshes(), 0);
  assert.equal(cancelled.states.some(state => state.connected), false);
  assert.equal(current.states.at(-1).connected, true);
  current.handle.close();
});

test("slow removal for one match does not delay a different match topic", async t => {
  const f = fixture(t);
  f.join("device-a", "one").handle.close();
  const other = f.join("device-b", "two");
  assert.equal(f.created.length, 2);
  assert.equal(other.states.at(-1).connected, true);
  assert.equal(f.active.has("match-recording:two"), true);
  other.handle.close();
  await f.flush();
});
