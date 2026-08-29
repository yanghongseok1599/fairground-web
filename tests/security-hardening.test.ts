import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
const authStore = fs.readFileSync(path.join(root, "src/stores/authStore.ts"), "utf8");

function numericVersion(value: string): number[] {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, `버전 형식을 확인할 수 없습니다: ${value}`);
  return match.slice(1).map(Number);
}

function versionAtLeast(value: string, minimum: string): boolean {
  const actualParts = numericVersion(value);
  const minimumParts = numericVersion(minimum);

  for (let index = 0; index < 3; index += 1) {
    if (actualParts[index] > minimumParts[index]) return true;
    if (actualParts[index] < minimumParts[index]) return false;
  }
  return true;
}

test("보안 패치가 포함된 Next.js와 PostCSS 버전을 사용한다", () => {
  assert.equal(versionAtLeast(packageJson.dependencies.next, "16.3.3"), true);
  assert.equal(versionAtLeast(packageJson.overrides.postcss, "8.5.23"), true);
});

test("기본 보안 헤더와 제한적 CSP를 설정한다", () => {
  for (const expected of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-Permitted-Cross-Domain-Policies",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ]) {
    assert.equal(nextConfig.includes(expected), true, `${expected} 보안 설정이 필요합니다.`);
  }
});

test("고정 로컬 관리자 계정은 Supabase 미설정 데모 모드에서만 허용한다", () => {
  const guardStart = authStore.indexOf("function canUseLocalAdminOverride");
  const guardEnd = authStore.indexOf("function isLocalAdminCredentials", guardStart);
  const guardBody = authStore.slice(guardStart, guardEnd);

  assert.match(guardBody, /if \(!isDemoMode\) return false/);
  assert.match(guardBody, /process\.env\.NODE_ENV === "production"/);
  assert.match(guardBody, /window\.location\.hostname/);
  assert.doesNotMatch(authStore, /LOCAL_ADMIN_PASSWORD\s*=\s*["']\d+["']/);
  assert.match(authStore, /NEXT_PUBLIC_DEMO_ADMIN_PASSWORD/);
});
