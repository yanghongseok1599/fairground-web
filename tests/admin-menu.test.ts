import assert from "node:assert/strict";
import { getAdminMenuItems } from "../src/lib/admin-menu.ts";

const adminItems = getAdminMenuItems("admin");
assert.deepEqual(
  adminItems.map((item) => item.href),
  [
    "/admin/survey",
    "/admin/inspections",
    "/admin/matches",
    "/admin/tournaments",
    "/admin/entry-fees",
    "/admin/players",
    "/admin/skill-challenge",
    "/admin/referees",
    "/admin/teams",
    "/admin/coaches",
    "/admin/penalties",
    "/admin/reports",
    "/admin/popups",
    "/admin/push",
  ],
);
assert.equal(adminItems.every((item) => item.href !== "/admin"), true);

const refereeItems = getAdminMenuItems("referee");
assert.deepEqual(refereeItems.map((item) => item.href), ["/admin/matches"]);

assert.deepEqual(getAdminMenuItems("player", true).map((item) => item.href), ["/admin/inspections"]);
assert.deepEqual(getAdminMenuItems("captain", true).map((item) => item.href), ["/admin/inspections"]);
assert.deepEqual(getAdminMenuItems("player"), []);
assert.deepEqual(getAdminMenuItems(undefined, true), []);
assert.equal(getAdminMenuItems("admin", true).length, adminItems.length);
console.log("admin-menu tests passed");
