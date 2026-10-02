import assert from "node:assert/strict";
import test from "node:test";
import { RealtimeClient } from "@supabase/realtime-js";
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
        async track(value) { this.tracks.push(value); return "ok"; },
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
  b.handle.setPending(4, 3, 10);
  b.handle.setPending(3, 2, 11);
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
  assert.deepEqual(current.tracks.at(-1), { name: "device-b", pending: 3, blockingPending: 2, queueRevision: 11 });
  assert.equal(b.states.at(-1).connected, true);
  assert.equal(a.refreshes(), 1); // Late callbacks from the closed provider do not run.
  b.handle.close();
});

test("cancelled waiting provider never joins after removal, while its replacement can join", async t => {
  const f = fixture(t);
  const a = f.join("device-a");
  a.handle.close();
  const cancelled = f.join("device-b");
  cancelled.handle.setPending(9, 9, 1);
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

test("unexpected CLOSED rejoins after removal with buffered counts; own close never reconnects", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  const recorder = f.join("device-a");
  recorder.handle.setPending(2, 2, 11);
  await f.flush();
  const old = f.created[0];
  old.state = "closed"; old.status("CLOSED");
  await f.flush();
  recorder.handle.setPending(0, 0, 12);
  t.mock.timers.tick(1000);
  await f.flush();
  assert.equal(f.created.length, 1); // Removal is still in flight.
  f.removals.shift()();
  await f.flush();
  assert.equal(f.created.length, 2);
  const next = f.created[1];
  assert.deepEqual(next.tracks.at(-1), { name: "device-a", pending: 0, blockingPending: 0, queueRevision: 12 });
  old.status("SUBSCRIBED"); // Old callbacks cannot reactivate the replaced channel.
  assert.equal(f.active.get("match-recording:match"), next);
  recorder.handle.close();
  await f.flush();
  f.removals.shift()();
  t.mock.timers.tick(5000);
  await f.flush();
  assert.equal(f.created.length, 2);
});

test("SDK teardown abandoning an in-flight track cannot block a replacement channel's latest presence", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  const recorder = f.join("device-a");
  await f.flush();
  const old = f.created[0];

  // Exercise the installed SDK's real send/teardown behavior with no network.
  const sdk = new RealtimeClient("wss://synthetic.invalid/realtime/v1", { params: { apikey: "synthetic" }, timeout: 15 });
  const abandoned = sdk.channel("synthetic-old-channel");
  const raw = abandoned.channelAdapter.getChannel();
  raw.joinedOnce = true;
  raw.state = "joined";
  raw.socket.isConnected = () => true;
  raw.socket.push = () => {};
  let oldSettled = false;
  old.track = value => abandoned.track(value).then(result => { oldSettled = true; return result; });
  recorder.handle.setPending(2, 2, 11);
  raw.trigger("phx_close", {});
  assert.equal(await sdk.removeChannel(abandoned), "ok");
  t.mock.timers.tick(30);
  await f.flush();
  assert.equal(oldSettled, false); // Teardown removes the SDK's timeout reply binding.
  assert.equal(raw.bindings.length, 0);
  assert.equal(sdk.getChannels().length, 0);

  old.state = "closed"; old.status("CLOSED");
  await f.flush();
  recorder.handle.setPending(0, 0, 12);
  f.removals.shift()();
  t.mock.timers.tick(1000);
  await f.flush();
  const next = f.created[1];
  assert.ok(next);
  assert.deepEqual(next.tracks.at(-1), { name: "device-a", pending: 0, blockingPending: 0, queueRevision: 12 });
  assert.equal(recorder.states.at(-1).connected, true);
  assert.equal(oldSettled, false);
  recorder.handle.close();
  await f.flush();
  f.removals.shift()();
});
