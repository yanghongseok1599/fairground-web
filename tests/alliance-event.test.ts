import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyCommand,
  createEvent,
  effectiveScene,
  validateSetup,
  validateValue,
} from "../src/features/alliance-event/engine.ts";
import {
  gameStandings,
  overallStandings,
  tiedGroups,
  tieComplete,
} from "../src/features/alliance-event/scoring.ts";
import {
  EventStoreError,
  newLocalEvent,
  readLocalEvent,
  writeLocalEvent,
} from "../src/features/alliance-event/server/store.ts";
import { eventBody } from "../src/features/alliance-event/server/http.ts";
import { createRequestId } from "../src/features/alliance-event/request-id.ts";
import {
  currentEventStep,
  pendingTurns,
  rosterIssue,
} from "../src/features/alliance-event/workflow.ts";
import {
  drawSourcePairs,
  randomizeSetup,
} from "../src/features/alliance-event/pairing.ts";
import type {
  Command,
  EventState,
} from "../src/features/alliance-event/types.ts";

const now = 1_800_000_000_000;
const initial = () => createEvent(randomUUID(), true, now, (max) => max - 1);
const apply = (state: EventState, command: Command, time = now) =>
  applyCommand(state, command, time, randomUUID);
const seeded = () => apply(initial(), { type: "demo-records" });
const pair = ["alliance-1", "alliance-4"];

test("guided game queue alternates representatives and resumes without recording the same turn twice", () => {
  let state = apply(initial(), { type: "lock" });
  assert.equal(pendingTurns(state, "shooting").length, 24);
  assert.deepEqual(
    pendingTurns(state, "shooting")
      .slice(0, 4)
      .map((t) => [t.teamId, t.slot]),
    [
      [pair[0], "male"],
      [pair[1], "male"],
      [pair[0], "female"],
      [pair[1], "female"],
    ],
  );
  const first = pendingTurns(state, "shooting")[0];
  state = apply(state, {
    type: "record",
    game: "shooting",
    ...first,
    value: 95.2,
  });
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(pendingTurns(restored, "shooting").length, 23);
  assert.equal(pendingTurns(restored, "shooting")[0].teamId, pair[1]);
  assert.equal(restored.output.scene, "reveal");
  assert(!pendingTurns(restored, "shooting").some((t) => t.key === first.key));
  state = apply(state, { type: "void", attemptId: state.attempts[0].id });
  assert.equal(pendingTurns(state, "shooting")[0].key, first.key);
  assert.equal(pendingTurns(state, "keepUp").length, 12);
});

test("guided steps advance only on confirmed results and return to the game after a correction", () => {
  assert.equal(currentEventStep(initial()), 0);
  let state = seeded();
  assert.equal(currentEventStep(state), 1);
  assert.equal(pendingTurns(state, "shooting").length, 0);
  state = apply(state, { type: "finalize", game: "shooting" });
  assert.equal(currentEventStep(state), 2);
  state = apply(state, { type: "finalize", game: "keepUp" });
  assert.equal(currentEventStep(state), 3);
  state = apply(state, { type: "void", attemptId: state.attempts[0].id });
  assert.equal(currentEventStep(state), 1);
  assert.equal(pendingTurns(state, "shooting").length, 1);
  const team = state.setup.teams[0];
  assert.equal(rosterIssue(team), null);
  assert.match(rosterIssue({ ...team, female: "" })!, /여자 대표/);
});

test("automatic draws use every source once and always create three alliances per group", () => {
  const setup = initial().setup;
  const before = structuredClone(setup);
  for (let i = 0; i < 100; i++) {
    const pairs = drawSourcePairs(setup.sources);
    assert.equal(pairs.length, 6);
    assert.deepEqual(
      [...pairs.flat()].sort(),
      setup.sources.map((s) => s.id).sort(),
    );
    pairs.forEach((ids, index) =>
      assert(ids.every((id) => id.startsWith(index < 3 ? "A" : "B"))),
    );
  }
  assert.deepEqual(setup, before);
  const state = createEvent(randomUUID(), true, now, () => 0);
  assert.deepEqual(state.setup.teams[0].sourceIds, ["A2", "A3"]);
  assert.deepEqual(state.setup.teams[3].sourceIds, ["B2", "B3"]);
  assert.deepEqual(state.output.teams, state.setup.teams);
  validateSetup(state.setup, true);
});

test("redrawing clears changed alliances' rosters, retains names and unchanged rosters, and cannot edit a locked event", () => {
  const state = initial();
  const before = structuredClone(state.setup);
  const identical = randomizeSetup(state.setup, (max) => max - 1);
  assert.deepEqual(identical, before);
  const next = randomizeSetup(state.setup, () => 0);
  validateSetup(next, false);
  assert.deepEqual(state.setup, before);
  next.teams.forEach((team, i) => {
    assert.equal(team.name, before.teams[i].name);
    assert.equal(team.male, "");
    assert.equal(team.female, "");
    assert.deepEqual(team.keepUpPlayers, Array(6).fill(""));
  });
  const saved = apply(state, { type: "setup", setup: next });
  assert.deepEqual(saved.setup.teams, saved.output.teams);
  assert.throws(() => apply(saved, { type: "lock" }), /대표/);
  assert.throws(
    () => apply(apply(state, { type: "lock" }), { type: "setup", setup: next }),
    /확정 후/,
  );
});

test("request IDs work on LAN browsers without the secure-context randomUUID API", () => {
  const ids = Array.from({ length: 100 }, createRequestId);
  assert.equal(new Set(ids).size, 100);
  for (const id of ids)
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});

test("100/1,000 scoring has no shared total for 36 distinct rank combinations; the main game always decides order", () => {
  const totals = new Set<number>();
  for (let keepRank = 1; keepRank <= 6; keepRank++) {
    const values = [];
    for (let shootRank = 1; shootRank <= 6; shootRank++) {
      const value = (6 - shootRank) * 20 + (6 - keepRank) * 200;
      assert(!totals.has(value));
      totals.add(value);
      values.push(value);
    }
    if (keepRank < 6) assert(Math.min(...values) > (5 - keepRank) * 200 + 100);
  }
  assert.equal(totals.size, 36);
});

test("pairing requires all 12 sources exactly once, within each source group, and confirmed rosters", () => {
  const good = initial().setup;
  validateSetup(good, true);
  const duplicate = structuredClone(good);
  duplicate.teams[0].sourceIds[1] = "A1";
  assert.throws(() => validateSetup(duplicate, true), /중복/);
  const crossed = structuredClone(good);
  crossed.teams[0].sourceIds[1] = "B1";
  assert.throws(() => validateSetup(crossed, true), /같은 조/);
  const roster = structuredClone(good);
  roster.teams[0].female = roster.teams[0].male;
  assert.throws(() => validateSetup(roster, true), /남녀 대표/);
  roster.teams[0].female = "다른 대표";
  roster.teams[0].keepUpPlayers[1] = roster.teams[0].keepUpPlayers[0];
  assert.throws(() => validateSetup(roster, true), /중복 없이/);
});

test("speed is never silently clamped; invalid, fractional-count and precision errors are rejected", () => {
  validateValue(156.7, "shooting", "seconds");
  for (const n of [0, -5, NaN, Infinity, 300.1, 95.23])
    assert.throws(() => validateValue(n, "shooting", "seconds"));
  validateValue(43.27, "keepUp", "seconds");
  assert.throws(() => validateValue(2.5, "keepUp", "touches"));
});

test("both male and female best results contribute; incomplete attempts block points and finalization", () => {
  let state = apply(initial(), { type: "lock" });
  const record = (slot: "male" | "female", value: number) => {
    state = apply(state, {
      type: "record",
      game: "shooting",
      teamId: pair[0],
      slot,
      value,
      pair,
    });
  };
  record("male", 120);
  record("male", 110);
  record("female", 80);
  record("female", 75);
  const row = gameStandings(state, "shooting").find(
    (r) => r.teamId === pair[0],
  )!;
  assert.equal(row.value, 100);
  assert.equal(row.complete, true);
  assert.equal(row.points, null);
  assert.throws(() => record("male", 130), /시도를 모두/);
  assert.throws(
    () => apply(state, { type: "finalize", game: "shooting" }),
    /미완료/,
  );
  assert.throws(
    () =>
      apply(state, {
        type: "show",
        scene: "winner",
        game: "shooting",
        pair,
        teamId: pair[0],
      }),
    /두 종목/,
  );
});

test("reveal uses persisted timestamps; holding and resuming preserves the remaining display time", () => {
  let state = apply(initial(), { type: "lock" });
  state = apply(state, {
    type: "record",
    game: "shooting",
    teamId: pair[0],
    slot: "male",
    value: 95.2,
    pair,
  });
  assert.equal(effectiveScene(state.output, now + 3999), "reveal");
  assert.equal(
    effectiveScene(JSON.parse(JSON.stringify(state.output)), now + 4000),
    "compare",
  );
  state = apply(state, { type: "hold" }, now + 1500);
  assert.equal(effectiveScene(state.output, now + 20000), "reveal");
  state = apply(state, { type: "resume" }, now + 20000);
  assert.equal(effectiveScene(state.output, now + 22499), "reveal");
  assert.equal(effectiveScene(state.output, now + 22500), "compare");
});

test("replaying a record does not create another attempt or change confirmed scores", () => {
  let state = apply(seeded(), { type: "finalize", game: "shooting" });
  const attempt = state.attempts[0];
  const before = structuredClone(state.attempts);
  state = apply(state, { type: "replay", attemptId: attempt.id }, now + 10000);
  assert.deepEqual(state.attempts, before);
  assert.equal(state.finalized.shooting, true);
  assert.equal(state.output.scene, "reveal");
  assert.equal(effectiveScene(state.output, now + 13999), "reveal");
  assert.equal(effectiveScene(state.output, now + 14000), "compare");
});

test("a tied main event cannot publish a winner; all tied teams must complete the replay before scoring", () => {
  let state = seeded();
  for (const a of state.attempts.filter(
    (a) => a.game === "keepUp" && a.teamId === pair[0],
  ))
    a.value += 14;
  const groups = tiedGroups(state, "keepUp");
  assert.equal(groups.length, 1);
  assert.deepEqual(new Set(groups[0]), new Set(pair));
  assert.throws(
    () => apply(state, { type: "finalize", game: "keepUp" }),
    /동률/,
  );
  state = apply(state, {
    type: "tiebreak",
    game: "keepUp",
    teamIds: groups[0],
  });
  const tieId = state.ties[0].id;
  state = apply(state, {
    type: "record",
    game: "keepUp",
    teamId: pair[0],
    value: 60,
    tieId,
    pair,
  });
  assert(!tieComplete(state, state.ties[0]));
  assert(gameStandings(state, "keepUp").every((r) => r.points === null));
  state = apply(state, {
    type: "record",
    game: "keepUp",
    teamId: pair[1],
    value: 59,
    tieId,
    pair,
  });
  assert(tieComplete(state, state.ties[0]));
  assert.equal(gameStandings(state, "keepUp")[0].teamId, pair[0]);
  state = apply(state, { type: "finalize", game: "shooting" });
  state = apply(state, { type: "finalize", game: "keepUp" });
  state = apply(state, {
    type: "show",
    scene: "winner",
    game: "keepUp",
    teamId: pair[0],
    pair,
  });
  assert.equal(state.output.winnerId, pair[0]);
});

test("a second tie requires another complete replay, not an arbitrary ordering", () => {
  let state = seeded();
  for (const a of state.attempts.filter(
    (a) => a.game === "keepUp" && a.teamId === pair[0],
  ))
    a.value += 14;
  for (let round = 0; round < 2; round++) {
    state = apply(state, { type: "tiebreak", game: "keepUp", teamIds: pair });
    const tieId = state.ties.at(-1)!.id;
    for (const teamId of pair)
      state = apply(state, {
        type: "record",
        game: "keepUp",
        teamId,
        value: round === 1 && teamId === pair[1] ? 51 : 50,
        pair,
        tieId,
      });
    if (round === 0) assert.equal(tiedGroups(state, "keepUp").length, 1);
  }
  assert.equal(gameStandings(state, "keepUp")[0].teamId, pair[1]);
});

test("correcting/voiding a published record invalidates results and removes a stale winner snapshot", () => {
  let state = seeded();
  state = apply(state, { type: "finalize", game: "shooting" });
  state = apply(state, { type: "finalize", game: "keepUp" });
  const overall = overallStandings(state);
  assert.equal(overall[0].teamId, pair[1]);
  assert.equal(overall[0].total, 1040);
  state = apply(state, {
    type: "show",
    scene: "winner",
    game: "keepUp",
    pair,
    teamId: pair[1],
  });
  const attemptId = state.attempts.find((a) => a.game === "keepUp")!.id;
  state = apply(state, { type: "void", attemptId });
  assert.equal(state.finalized.keepUp, false);
  assert.equal(state.output.winnerId, null);
  assert.notEqual(state.output.scene, "winner");
  assert.equal(state.attempts.find((a) => a.id === attemptId)!.voided, true);
});

test("local storage authorizes operators, excludes drafts from public reads, persists changes and deduplicates retries", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fg-event-test-"));
  const prior = {
    local: process.env.FAIRGROUND_EVENT_LOCAL,
    dir: process.env.FAIRGROUND_EVENT_DATA_DIR,
    vercel: process.env.VERCEL,
  };
  process.env.FAIRGROUND_EVENT_LOCAL = "1";
  process.env.FAIRGROUND_EVENT_DATA_DIR = dir;
  delete process.env.VERCEL;
  try {
    const { id, token } = await newLocalEvent(true);
    const pub = await readLocalEvent(id);
    assert(!("state" in pub));
    assert(!JSON.stringify(pub).includes(token));
    assert(!("attempts" in pub));
    await assert.rejects(
      () => readLocalEvent(id, "wrong"),
      (e) => e instanceof EventStoreError && e.status === 403,
    );
    const requestId = randomUUID();
    const results = await Promise.all([
      writeLocalEvent(id, token, 0, requestId, { type: "lock" }),
      writeLocalEvent(id, token, 0, requestId, { type: "lock" }),
    ]);
    assert(results.every((r) => r.state.version === 1));
    await assert.rejects(
      () => writeLocalEvent(id, token, 0, randomUUID(), { type: "lock" }),
      (e) => e instanceof EventStoreError && e.status === 409,
    );
    const reloaded = await readLocalEvent(id, token);
    assert("state" in reloaded && reloaded.state?.locked);
    await assert.rejects(() => readLocalEvent("../../private"), /주소/);
    process.env.VERCEL = "1";
    await assert.rejects(
      () => newLocalEvent(false),
      (e) => e instanceof EventStoreError && e.status === 503,
    );
  } finally {
    for (const [key, value] of Object.entries({
      FAIRGROUND_EVENT_LOCAL: prior.local,
      FAIRGROUND_EVENT_DATA_DIR: prior.dir,
      VERCEL: prior.vercel,
    }))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    await rm(dir, { recursive: true, force: true });
  }
});

test("write endpoints reject cross-origin, oversized and malformed requests", async () => {
  assert.deepEqual(
    await eventBody(
      new Request("http://0.0.0.0:3100/api/alliance-events", {
        method: "POST",
        headers: {
          Host: "localhost:3100",
          Origin: "http://localhost:3100",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    ),
    {},
  );
  await assert.rejects(
    () =>
      eventBody(
        new Request("http://localhost:3100/api/alliance-events", {
          method: "POST",
          headers: {
            Origin: "https://other.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
      ),
    (e) => e instanceof EventStoreError && e.status === 403,
  );
  await assert.rejects(
    () =>
      eventBody(
        new Request("http://localhost:3100/api/alliance-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "x".repeat(256001),
        }),
      ),
    (e) => e instanceof EventStoreError && e.status === 413,
  );
  await assert.rejects(
    () =>
      eventBody(
        new Request("http://localhost:3100/api/alliance-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not-json",
        }),
      ),
    /형식/,
  );
});
