import assert from "node:assert/strict";
import { buildAutoGroups, buildGroupRoundRobinMatches } from "../src/lib/auto-matchmaking.ts";

const teams = [
  { id: "t1", name: "A", points: 12 },
  { id: "t2", name: "B", points: 10 },
  { id: "t3", name: "C", points: 8 },
  { id: "t4", name: "D", points: 6 },
  { id: "t5", name: "E", points: 4 },
  { id: "t6", name: "F", points: 2 },
];

const groups = buildAutoGroups(teams, 2);
assert.equal(groups.length, 2);
assert.deepEqual(groups.map((g) => g.name), ["A조", "B조"]);
assert.deepEqual(groups[0].teamIds, ["t1", "t4", "t5"]);
assert.deepEqual(groups[1].teamIds, ["t2", "t3", "t6"]);
assert.equal(groups[0].standings[0].teamName, "A");
assert.equal(groups[0].standings[0].points, 0);

const matches = buildGroupRoundRobinMatches(groups, teams, "tour1", 7);
assert.equal(matches.length, 6);
assert.deepEqual(
  matches.map((m) => `${m.groupId}:${m.round}:${m.homeTeamName}-${m.awayTeamName}`),
  [
    "group-a:7:A-D",
    "group-a:8:A-E",
    "group-a:9:D-E",
    "group-b:7:B-C",
    "group-b:8:B-F",
    "group-b:9:C-F",
  ]
);

console.log("auto-matchmaking tests passed");
