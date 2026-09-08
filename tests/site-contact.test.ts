import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  SITE_CONTACT_EMAIL,
  SITE_CONTACT_MAILTO,
} from "../src/lib/site-config.ts";

const root = process.cwd();
const footer = fs.readFileSync(path.join(root, "src/components/site-footer.tsx"), "utf8");
const forgotPassword = fs.readFileSync(
  path.join(root, "src/app/auth/forgot-password/page.tsx"),
  "utf8",
);
const seo = fs.readFileSync(path.join(root, "src/lib/seo.ts"), "utf8");

assert.equal(SITE_CONTACT_EMAIL, "info@fairground-kor.com");
assert.equal(SITE_CONTACT_MAILTO, "mailto:info@fairground-kor.com");
assert.match(footer, /SITE_CONTACT_MAILTO/);
assert.match(footer, /SITE_CONTACT_EMAIL/);
assert.match(forgotPassword, /SITE_CONTACT_MAILTO/);
assert.match(seo, /email: SITE_CONTACT_EMAIL/);
assert.match(seo, /contactPoint/);

console.log("site contact tests passed");
