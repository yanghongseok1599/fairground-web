import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
const authStore = fs.readFileSync(path.join(root, "src/stores/authStore.ts"), "utf8");
const mappers = fs.readFileSync(path.join(root, "src/lib/mappers.ts"), "utf8");
const dataStore = fs.readFileSync(path.join(root, "src/stores/dataStore.ts"), "utf8");
const playersPage = fs.readFileSync(path.join(root, "src/app/players/page.tsx"), "utf8");
const teamAdminPage = fs.readFileSync(
  path.join(root, "src/app/teams/[id]/admin/page.tsx"),
  "utf8",
);
const authorizationMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260829020000_codex_security_authorization_hardening.sql",
  ),
  "utf8",
);

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

test("승인된 프로필의 팀 식별자와 일반 본인 수정 경로를 함께 잠근다", () => {
  assert.match(authorizationMigration, /new\.team_id is distinct from old\.team_id/);
  assert.match(authorizationMigration, /coalesce\(old\.is_approved, false\)/);
  assert.match(authorizationMigration, /create trigger trg_guard_privileged_profile_cols/);
  assert.match(authorizationMigration, /create trigger trg_guard_team_role_change/);
  assert.match(authStore, /selfEditablePlayerPatch\(data, state\.player\)/);

  const selfPatchStart = mappers.indexOf("export function selfEditablePlayerPatch");
  const selfPatch = mappers.slice(selfPatchStart);
  for (const field of ["teamId", "teamRole", "role"]) {
    assert.match(selfPatch, new RegExp(`delete editable\\.${field}`));
  }
});

test("가입 신청은 잠금된 status 전용 RPC로만 처리한다", () => {
  assert.match(authorizationMigration, /create or replace function public\.process_team_join_request/);
  assert.match(authorizationMigration, /where id = p_request_id\s+for update/);
  assert.match(authorizationMigration, /v_request\.status <> 'pending'/);
  assert.match(authorizationMigration, /v_profile\.team_id is not null/);
  assert.match(authorizationMigration, /drop policy if exists "team_join_requests_update_director"/);
  assert.match(authorizationMigration, /revoke update on public\.team_join_requests from anon, authenticated/);
  assert.match(dataStore, /supabase\.rpc\("process_team_join_request"/);
  assert.doesNotMatch(dataStore, /\.from\("team_join_requests"\)\s*\.update\(\{ status \}\)/);
});

test("공개 선수 데이터는 승인된 공개 projection만 사용하고 PII를 제외한다", () => {
  const viewStart = authorizationMigration.indexOf("create or replace view public.public_player_profiles");
  const viewEnd = authorizationMigration.indexOf("from public.profiles", viewStart);
  const projection = authorizationMigration.slice(viewStart, viewEnd);

  assert.ok(viewStart >= 0 && viewEnd > viewStart);
  for (const privateColumn of [
    "phone",
    "email",
    "birth_date",
    "gender",
    "has_player_experience",
    "portrait_consent_at",
    "team_role",
  ]) {
    assert.doesNotMatch(projection, new RegExp(`\\b${privateColumn}\\b`));
  }
  assert.match(authorizationMigration, /revoke select on public\.profiles from anon, authenticated/);
  assert.match(authorizationMigration, /as restrictive\s+for select\s+to anon/);
  assert.match(authorizationMigration, /create or replace function public\.get_my_profile/);
  assert.match(authorizationMigration, /create or replace function public\.get_admin_profiles/);
  assert.match(authorizationMigration, /create or replace function public\.get_team_admin_profiles/);
  assert.match(authorizationMigration, /create or replace function public\.get_team_join_request_profiles/);
  assert.match(playersPage, /fetchPublicPlayers\(\)/);
  assert.match(teamAdminPage, /fetchTeamAdminMembers\(id\)/);
  assert.doesNotMatch(dataStore, /from\("profiles"\)\s*\.select\("\*"\)/);
  assert.doesNotMatch(authStore, /from\("profiles"\)\.select\("\*"\)/);
  assert.match(dataStore, /from\("public_player_profiles"\)/);
});

test("익명 프로필·팀 등록과 소유자 없는 Telegram 알림을 차단한다", () => {
  assert.match(authorizationMigration, /revoke insert on public\.profiles from anon/);
  assert.match(authorizationMigration, /revoke insert on public\.teams from anon/);
  assert.match(authorizationMigration, /id = auth\.uid\(\)/);
  assert.match(authorizationMigration, /captain_id = auth\.uid\(\)/);
  assert.match(authorizationMigration, /when \(new\.captain_id is not null\)/);
  assert.doesNotMatch(
    authorizationMigration,
    /create policy "Allow public pending (player|team) registration"/,
  );
});
