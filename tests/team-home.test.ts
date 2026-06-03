import assert from "node:assert/strict";
import { buildTeamClubhouseAnchor, buildTeamRecordLine, getRosterFilterCount } from "../src/lib/team-home.ts";

const players = [
  { position: "GK" },
  { position: "ALA" },
  { position: "ALA" },
  { position: "PIVO" },
] as const;

assert.equal(buildTeamRecordLine({ wins: 3, draws: 1, losses: 2 }), "3W 1D 2L");
assert.equal(getRosterFilterCount(players, "ALL"), 4);
assert.equal(getRosterFilterCount(players, "ALA"), 2);
assert.equal(getRosterFilterCount(players, "FIXO"), 0);
assert.equal(buildTeamClubhouseAnchor(), "#team-operations");

console.log("team-home tests passed");
