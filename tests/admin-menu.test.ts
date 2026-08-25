import assert from "node:assert/strict";
import { getAdminMenuItems } from "../src/lib/admin-menu.ts";

const adminItems = getAdminMenuItems("admin");
assert.deepEqual(
  adminItems.map((item) => item.href),
  [
    "/admin/matches",
    "/admin/players",
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

console.log("admin-menu tests passed");
