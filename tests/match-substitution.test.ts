import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubstitution } from "../src/lib/match-substitution.ts";

const onCourt = [{ playerId: "a" }, { playerId: "b" }];
const bench = [{ playerId: "c" }];

test("코트선수 OUT + 벤치선수 IN → 유효", () => {
  assert.deepEqual(validateSubstitution({ outId: "a", inId: "c", onCourt, bench }), { ok: true });
});
test("OUT 이 코트에 없으면 무효", () => {
  assert.equal(validateSubstitution({ outId: "z", inId: "c", onCourt, bench }).ok, false);
});
test("IN 이 벤치에 없으면 무효", () => {
  assert.equal(validateSubstitution({ outId: "a", inId: "z", onCourt, bench }).ok, false);
});
test("OUT===IN 무효", () => {
  assert.equal(validateSubstitution({ outId: "a", inId: "a", onCourt, bench }).ok, false);
});

console.log("match-substitution tests passed");
