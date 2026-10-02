import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { moduleLoader } from "./helpers/load-ts-module.mjs";

const require = createRequire(import.meta.url);
const { Presence } = require("@supabase/phoenix");
const PresenceAdapter = require("../node_modules/@supabase/realtime-js/dist/main/phoenix/presenceAdapter.js").default;
const { createPendingPresenceTracker } = moduleLoader()("src/features/match-recording/presence-pending.ts");

test("installed Supabase presence state cannot retain stale queue counts after repeated track updates", () => {
  const join = (key, current, incoming) => PresenceAdapter.onJoinPayload(key, current, incoming);
  const leave = (key, current, incoming) => PresenceAdapter.onLeavePayload(key, current, incoming);
  const read = createPendingPresenceTracker("admin:device");
  let state = {};
  const counts = [0, 1, 2, 1, 0];
  for (const [index, pending] of counts.entries()) {
    const meta = { phx_ref: `ref-${index}`, pending, blockingPending: pending, queueRevision: index + 1 };
    if (index === 0) state = Presence.syncState(state, { peer: { metas: [meta] } }, join, leave);
    else state = Presence.syncDiff(state, {
      joins: { peer: { metas: [{ ...meta, phx_ref_prev: `ref-${index - 1}` }] } },
      leaves: { peer: { metas: [{ phx_ref: `ref-${index - 1}` }] } },
    }, join, leave);
    const rows = Object.entries(PresenceAdapter.transformState(state)).flatMap(([key, values]) => values.map(value => ({ ...value, key })));
    assert.deepEqual(read(rows), { pendingElsewhere: pending, blockingPendingElsewhere: pending });
  }
});
