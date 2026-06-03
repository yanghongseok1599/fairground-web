import assert from "node:assert/strict";
import { getAdminEntryLabel, isAdminLikeRole } from "../src/lib/admin-access.ts";

assert.equal(isAdminLikeRole("admin"), true);
assert.equal(isAdminLikeRole("referee"), true);
assert.equal(isAdminLikeRole("captain"), false);
assert.equal(isAdminLikeRole("player"), false);
assert.equal(isAdminLikeRole(undefined), false);

assert.equal(getAdminEntryLabel("admin"), "관리자");
assert.equal(getAdminEntryLabel("referee"), "심판 운영");
assert.equal(getAdminEntryLabel("player"), "마이페이지");
assert.equal(getAdminEntryLabel(undefined), "마이페이지");

console.log("admin-access tests passed");
