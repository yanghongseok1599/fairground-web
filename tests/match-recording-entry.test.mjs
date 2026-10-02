import assert from "node:assert/strict";
import test from "node:test";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const load = moduleLoader();
const { startRoomSession } = load("src/features/match-recording/room-session.ts");
const { prepareRecordingRoom, createRoomPublication } = load("src/features/match-recording/room-bootstrap.ts");
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function exclusiveLocks() {
  let owner = false;
  const queue = [];
  const requests = [];
  const drain = () => { if (!owner && queue.length) queue.shift()(); };
  return {
    requests,
    held: () => owner,
    request(name, options, callback) {
      requests.push(options);
      assert.notEqual(options.steal, true);
      if (options.ifAvailable && owner) return Promise.resolve().then(() => callback(null));
      return new Promise((resolve, reject) => {
        const abort = () => { const i = queue.indexOf(grant); if (i >= 0) queue.splice(i, 1); reject(options.signal.reason); };
        const grant = () => {
          if (options.signal?.aborted) { reject(options.signal.reason); return; }
          options.signal?.removeEventListener("abort", abort);
          assert.equal(owner, false); owner = true;
          Promise.resolve().then(() => callback({ name })).then(resolve, reject).finally(() => { owner = false; drain(); });
        };
        options.signal?.addEventListener("abort", abort, { once: true });
        if (owner) queue.push(grant); else grant();
      });
    },
  };
}

function start(locks, prepare, extra = {}) {
  const errors = [], phases = [];
  const session = startRoomSession({ locks, name: "actor:match", prepare, onError: error => errors.push(error),
    onWaiting: () => phases.push("waiting"), onPreparing: () => phases.push("preparing"), ...extra });
  return { ...session, errors, phases };
}

function bootstrap(guard, overrides = {}) {
  const writes = [], published = [];
  return {
    writes, published,
    options: {
      actorId: "actor", matchId: "match", allowed: true, hasProfile: true, guard,
      readRooms: async () => [],
      readSnapshot: async () => ({ id: "match", homeTeamId: "home", awayTeamId: "away", lineups: [{ playerId: "starter" }] }),
      fetchPlayers: async teamId => [{ id: teamId, teamId }],
      updateRoom: async (key, change, signal) => { assert.equal(signal, guard.signal); const room = change(); writes.push(room); return room; },
      publish: room => published.push(room),
      ...overrides,
    },
  };
}

test("cleanup releases ownership while initialization remains hung and ignores its late continuation", async () => {
  const locks = exclusiveLocks(), delayed = deferred();
  let lateWrites = 0, nextPrepared = 0;
  const first = start(locks, async guard => { await delayed.promise; guard.assertActive(); lateWrites++; });
  await flush(); first.close();
  const next = start(locks, async () => { nextPrepared++; });
  await flush();
  assert.equal(nextPrepared, 1);
  delayed.resolve(); await flush();
  assert.equal(lateWrites, 0);
  assert.deepEqual(first.errors, []);
  next.close(); await flush();
  assert.equal(locks.held(), false);
});

test("another live tab keeps its lock without timeout errors; closing it starts the waiting tab once", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const locks = exclusiveLocks(); let secondPrepared = 0;
  const first = start(locks, async () => {});
  await flush();
  const second = start(locks, async () => { secondPrepared++; });
  await flush(); t.mock.timers.tick(120_000); await flush();
  assert.deepEqual(second.phases, ["waiting"]);
  assert.deepEqual(second.errors, []);
  assert.equal(secondPrepared, 0);
  first.close(); await flush();
  assert.deepEqual(second.phases, ["waiting", "preparing"]);
  assert.equal(secondPrepared, 1);
  second.close(); await flush();
});

test("cancelled waiting tab never initializes when the owner later closes", async () => {
  const locks = exclusiveLocks(); let calls = 0;
  const first = start(locks, async () => {}); await flush();
  const waiting = start(locks, async () => { calls++; }); await flush();
  waiting.close(); first.close(); await flush();
  assert.equal(calls, 0); assert.deepEqual(waiting.errors, []);
});

test("bootstrap deadline allows retry while a late snapshot cannot save, publish, or join", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const locks = exclusiveLocks(), snapshot = deferred();
  let original, joins = 0, retryPrepared = 0;
  const first = start(locks, async guard => {
    original = bootstrap(guard, { readSnapshot: () => snapshot.promise });
    await prepareRecordingRoom(original.options);
    guard.assertActive(); joins++;
  });
  await flush(); t.mock.timers.tick(30_000); await flush();
  assert.equal(first.errors.length, 1);
  assert.match(first.errors[0].message, /저장된 기록은 유지/);
  const retry = start(locks, async () => { retryPrepared++; }); await flush();
  snapshot.resolve({ id: "match", homeTeamId: "home", awayTeamId: "away" }); await flush();
  assert.equal(retryPrepared, 1); assert.equal(joins, 0);
  assert.deepEqual(original.writes, []); assert.deepEqual(original.published, []);
  retry.close(); await flush();
});

test("late IndexedDB reads and rosters stop at cancellation before a storage write", async () => {
  for (const blockedStage of ["readRooms", "fetchPlayers"]) {
    const delayed = deferred(), locks = exclusiveLocks(); let f;
    const session = start(locks, async guard => {
      f = bootstrap(guard, { [blockedStage]: () => delayed.promise });
      await prepareRecordingRoom(f.options);
    });
    await flush(); session.close();
    delayed.resolve(blockedStage === "readRooms" ? [] : [{ id: "player" }]); await flush();
    assert.deepEqual(f.writes, []); assert.deepEqual(f.published, []);
  }
});

test("adapter failure stays visible and cannot commit a supposedly ready room", async () => {
  const locks = exclusiveLocks(); let visible = 0;
  const publication = createRoomPublication(() => { throw new Error("기기 저장소 접근 실패"); }, () => { visible++; });
  const cached = { matchId: "match", revision: 4, pending: [{ id: "saved-goal" }], journal: [{ id: "saved-goal" }] };
  const before = structuredClone(cached);
  const session = start(locks, async guard => {
    const f = bootstrap(guard, { readRooms: async () => [cached], publish: room => publication.publish(room) });
    await prepareRecordingRoom(f.options);
  });
  await flush();
  assert.equal(publication.current, undefined);
  assert.equal(visible, 0); assert.equal(session.errors[0].message, "기기 저장소 접근 실패");
  assert.deepEqual(cached, before); assert.equal(locks.held(), false);
});

test("offline cached records render unchanged without any network request or initializer write", async () => {
  const locks = exclusiveLocks(), cached = { matchId: "match", revision: 4, pending: [{ id: "saved-goal" }], journal: [{ id: "saved-goal" }] };
  let f;
  const session = start(locks, async guard => {
    f = bootstrap(guard, { readRooms: async () => [cached], readSnapshot: () => { throw new Error("Must not request network"); } });
    await prepareRecordingRoom(f.options);
  });
  await flush();
  assert.deepEqual(session.errors, []); assert.equal(f.published[0], cached); assert.deepEqual(f.writes, []);
  session.close(); await flush();
});

test("initialization uses the authoritative snapshot lineup and rechecks cancellation inside the write callback", async () => {
  const locks = exclusiveLocks(); let saved, f, write;
  const session = start(locks, async guard => {
    f = bootstrap(guard);
    await prepareRecordingRoom(f.options); saved = f.writes[0];
  });
  await flush(); assert.deepEqual(saved.lineups, [{ playerId: "starter" }]); session.close(); await flush();
  const blocked = start(locks, async guard => {
    f = bootstrap(guard, { updateRoom: (_key, change) => { write = change; return new Promise(() => {}); } });
    await prepareRecordingRoom(f.options);
  });
  await flush(); blocked.close(); await flush();
  assert.throws(() => write(), { name: "AbortError" }); assert.deepEqual(f.published, []);
});

function adapterFixture(t, update) {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const room = { key: "actor:match", actorId: "actor", matchId: "match", revision: 1, pending: [], journal: [], players: [], lineups: [],
    base: { id: "match", status: "live", homeTeamId: "home", awayTeamId: "away", homeScore: 0, awayScore: 0, events: [],
      elapsedSeconds: 30, currentHalf: 1, isRunning: true, clock: { version: 1, ownerId: "actor", deviceId: "device", ownerName: "심판" } } };
  const { createRecordingAdapter } = moduleLoader({
    "@/stores/dataStore": { useDataStore: { getState: () => ({}) } },
    "@/stores/authStore": { useAuthStore: { getState: () => ({ user: { uid: "actor" }, player: { name: "심판" } }) } },
    "./device": { recordingDeviceId: () => "device" },
    "./storage": { updateRoom: update },
  })("src/features/match-recording/adapter.ts");
  return { room, createRecordingAdapter };
}

test("stale UI commands and old clock intervals cannot write after room ownership is released", async t => {
  const gate = deferred(); let active = true, calls = 0, stored;
  const f = adapterFixture(t, async (_key, change) => { calls++; await gate.promise; stored = change(stored); return stored; });
  stored = f.room;
  const stale = f.createRecordingAdapter(stored, () => active).store.getState();
  const rejected = assert.rejects(stale.pauseMatch(), /기록 준비가 해제/);
  active = false; gate.resolve(); await rejected;
  assert.equal(stored.pending.length, 0);
  await assert.rejects(stale.pauseMatch(), /기록 준비가 해제/);
  await assert.rejects(stale.updateMatchTimer("match", 31, 1), /기록 준비가 해제/);
  assert.equal(calls, 1);
  const current = f.createRecordingAdapter(stored, () => true).store.getState();
  await current.pauseMatch();
  assert.equal(stored.pending.length, 1); assert.equal(stored.journal.length, 1);
});

test("an accepted user command finishes durable storage even if its screen closes during commit", async t => {
  const commit = deferred(); let active = true, stored;
  const f = adapterFixture(t, async (_key, change, signal) => {
    assert.equal(signal, undefined); // Session cancellation must not discard already accepted user input.
    stored = change(stored); await commit.promise; return stored;
  });
  stored = f.room;
  const pending = f.createRecordingAdapter(stored, () => active).store.getState().pauseMatch();
  active = false; commit.resolve(); await pending;
  assert.equal(stored.pending.length, 1); assert.deepEqual(stored.pending, stored.journal);
});
