import assert from "node:assert/strict";
import {
  buildTeamAdminPath,
  canManageTeamAsDirector,
  getTeamAdminMemberBuckets,
  getTeamAdminPrimaryActions,
} from "../src/lib/team-admin.ts";

const players = [
  { id: "coach-1", role: "player", teamRole: "coach", isApproved: true, createdAt: 30 },
  { id: "player-1", role: "player", isApproved: true, createdAt: 20 },
  { id: "pending-new", role: "player", isApproved: false, createdAt: 50 },
  { id: "pending-old", role: "player", isApproved: false, createdAt: 10 },
] as const;

assert.equal(buildTeamAdminPath("team-123"), "/teams/team-123/admin");
assert.equal(canManageTeamAsDirector({ id: "coach-1", role: "player", teamId: "team-123", teamRole: "coach", isApproved: true }, { id: "team-123", captainId: "someone-else" }), true);
assert.equal(canManageTeamAsDirector({ id: "manager-1", role: "player", teamId: "team-123", teamRole: "manager", isApproved: true }, { id: "team-123", captainId: "someone-else" }), true);
assert.equal(canManageTeamAsDirector({ id: "pending-coach", role: "player", teamId: "team-123", teamRole: "coach", isApproved: false }, { id: "team-123", captainId: "someone-else" }), false);
assert.equal(canManageTeamAsDirector({ id: "captain-1", role: "player", teamId: "team-123", teamRole: "captain", isApproved: true }, { id: "team-123", captainId: "someone-else" }), false);
assert.equal(canManageTeamAsDirector({ id: "owner-1", role: "player", teamId: "team-123", isApproved: true }, { id: "team-123", captainId: "owner-1" }), true);
assert.equal(canManageTeamAsDirector({ id: "pending-owner", role: "player", teamId: "team-123", isApproved: false }, { id: "team-123", captainId: "pending-owner" }), false);
assert.equal(canManageTeamAsDirector({ id: "admin-1", role: "admin", teamId: "other", isApproved: false }, { id: "team-123" }), true);
assert.equal(canManageTeamAsDirector({ id: "player-1", role: "player", teamId: "team-123", isApproved: true }, { id: "team-123" }), false);
assert.equal(canManageTeamAsDirector(null, { id: "team-123" }), false);

const buckets = getTeamAdminMemberBuckets(players);
assert.deepEqual(buckets.approved.map((player) => player.id), ["coach-1", "player-1"]);
assert.deepEqual(buckets.pending.map((player) => player.id), ["pending-new", "pending-old"]);

const actions = getTeamAdminPrimaryActions("team-123");
assert.deepEqual(actions.map((action) => action.href), [
  "/teams/team-123/notices",
  "/teams/team-123/dues",
  "/teams/team-123/chat",
  "/teams/team-123/members",
]);

console.log("team-admin tests passed");
