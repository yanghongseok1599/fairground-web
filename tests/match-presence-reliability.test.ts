import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { createPendingPresenceTracker } from "../src/features/match-recording/presence-pending.ts";
import { createPresencePublisher, type QueuePresencePayload } from "../src/features/match-recording/presence-publisher.ts";

const peer = (queueRevision: number, pending: number, blockingPending = pending) => ({ key: "referee:device", queueRevision, pending, blockingPending });

test("accumulated historical presence rows use newest durable queue revision and count one device once", () => {
  const read = createPendingPresenceTracker("admin:device");
  assert.deepEqual(read([peer(1, 0), peer(2, 1), peer(3, 2), peer(4, 1), peer(5, 0)]), { pendingElsewhere: 0, blockingPendingElsewhere: 0 });
  // An out-of-order diff cannot resurrect an already acknowledged nonzero queue.
  assert.deepEqual(read([peer(2, 1), peer(3, 2)]), { pendingElsewhere: 0, blockingPendingElsewhere: 0 });
  assert.deepEqual(read([peer(6, 2), peer(6, 2)]), { pendingElsewhere: 2, blockingPendingElsewhere: 2 });
});

test("known offline records remain blocked until a newer zero from the same stable device", () => {
  const read = createPendingPresenceTracker("admin:device");
  read([peer(8, 3)]);
  assert.equal(read([]).blockingPendingElsewhere, 3);
  assert.equal(read([peer(7, 0)]).blockingPendingElsewhere, 3);
  assert.equal(read([{ key: "referee:other-device", queueRevision: 99, pending: 0 }]).blockingPendingElsewhere, 3);
  assert.deepEqual(read([peer(9, 1, 0)]), { pendingElsewhere: 1, blockingPendingElsewhere: 0 });
  assert.deepEqual(read([]), { pendingElsewhere: 0, blockingPendingElsewhere: 0 });
});

test("legacy rows stay conservative but cannot override a versioned zero", () => {
  const read = createPendingPresenceTracker("admin:device");
  const legacy = { key: "referee:device", pending: 2, blockingPending: 2 };
  assert.equal(read([legacy]).blockingPendingElsewhere, 2);
  assert.equal(read([{ ...legacy, pending: 0, blockingPending: 0 }]).blockingPendingElsewhere, 0);
  read([legacy]);
  assert.equal(read([legacy, peer(10, 0)]).blockingPendingElsewhere, 0);
  assert.equal(read([legacy]).blockingPendingElsewhere, 0);
});

function publisherFixture() {
  const sent: QueuePresencePayload[] = [];
  const responses: ((value: string) => void)[] = [];
  const scheduled: { callback: () => void; delay: number; cancelled: boolean }[] = [];
  const publisher = createPresencePublisher(payload => {
    sent.push(payload);
    return new Promise(resolve => responses.push(resolve));
  }, {
    schedule(callback, delay) { const timer = { callback, delay, cancelled: false }; scheduled.push(timer); return timer as unknown as ReturnType<typeof globalThis.setTimeout>; },
    cancel(timer) { (timer as unknown as { cancelled: boolean }).cancelled = true; },
  });
  const set = (queueRevision: number, pending: number) => publisher.set({ name: "심판", queueRevision, pending, blockingPending: pending });
  const fire = () => { const timer = scheduled.shift()!; if (!timer.cancelled) timer.callback(); return timer; };
  return { publisher, sent, responses, scheduled, set, fire };
}

test("track writes serialize and coalesce rapid changes to the latest zero", async () => {
  const f = publisherFixture();
  f.publisher.setActive(true);
  f.set(1, 2); f.set(2, 1); f.set(3, 0);
  assert.equal(f.sent.length, 1);
  f.responses.shift()!("ok"); await setImmediate();
  assert.deepEqual(f.sent.map(p => [p.queueRevision, p.pending]), [[1, 2], [3, 0]]);
  f.responses.shift()!("ok"); await setImmediate();
  assert.equal(f.scheduled.length, 0);
  f.publisher.close();
});

test("a timed-out zero retries without another state change and uses bounded backoff", async () => {
  const f = publisherFixture(); f.publisher.setActive(true); f.set(5, 0);
  for (const expectedDelay of [1000, 2000, 4000, 5000, 5000]) {
    f.responses.shift()!("timed out"); await setImmediate();
    assert.equal(f.scheduled[0].delay, expectedDelay);
    f.set(5, 0); // Same durable state must not suppress the outstanding retry.
    f.fire();
  }
  assert.equal(f.sent.length, 6);
  assert.ok(f.sent.every(p => p.pending === 0 && p.queueRevision === 5));
  f.responses.shift()!("ok"); await setImmediate();
  assert.equal(f.scheduled.length, 0);
  f.publisher.close();
});

test("failed older state retries the newest queue; disconnect and close cancel retry work", async () => {
  const f = publisherFixture(); f.publisher.setActive(true); f.set(1, 3);
  f.responses.shift()!("error"); await setImmediate();
  f.set(2, 0); f.fire();
  assert.equal(f.sent.at(-1)!.pending, 0);
  f.responses.shift()!("error"); await setImmediate();
  f.publisher.setActive(false);
  assert.equal(f.fire().cancelled, true);
  const calls = f.sent.length;
  f.publisher.setActive(true); // Reconnect republishes even unchanged latest state.
  assert.equal(f.sent.length, calls + 1);
  f.responses.shift()!("error"); await setImmediate();
  f.publisher.close();
  assert.equal(f.fire().cancelled, true);
});
