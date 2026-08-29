import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// 구글 로그인은 authStore 가 프로필을 자동 생성한다(이름 = 구글 full_name).
// 예전 온보딩은 "프로필 행이 있으면 완료"로 보고 /my 로 보내서, 구글 가입자는
// 선수 등록 화면(실명 입력)을 한 번도 거치지 않았다 → 로마자 이름 4건 발생.
test("온보딩은 프로필 존재가 아니라 선수 등록 완료 여부로 건너뛴다", () => {
  const src = read("src/app/onboarding/page.tsx");
  assert.match(src, /if \(player && hasCompletedPlayerCardSetup\(player\)\) \{\s*\n\s*router\.replace\("\/my"\)/);
  assert.ok(
    !/if \(player\) \{\s*\n\s*router\.replace\("\/my"\);\s*\n\s*\}/.test(src),
    "프로필 행만 보고 /my 로 보내면 구글 가입자가 실명 입력을 건너뛴다",
  );
});

test("OAuth 콜백 기본 착지점은 /onboarding", () => {
  const src = read("src/app/auth/callback/page.tsx");
  assert.match(src, /if \(!raw\) return "\/onboarding"/);
  assert.ok(!/if \(!raw\) return "\/my"/.test(src));
});

test("소셜 로그인은 Google과 Kakao 모두 공용 OAuth 콜백을 사용한다", () => {
  const store = read("src/stores/authStore.ts");
  const login = read("src/app/login/page.tsx");
  const register = read("src/app/register/page.tsx");

  assert.match(store, /startOAuthSignIn\("google", returnTo\)/);
  assert.match(store, /startOAuthSignIn\("kakao", returnTo\)/);
  assert.match(login, /onKakao=\{handleKakaoLogin\}/);
  assert.match(register, /onKakao=\{handleKakaoRegister\}/);
});

test("미완성 OAuth 프로필이 있어도 온보딩 선택 화면을 렌더링한다", () => {
  const src = read("src/app/onboarding/page.tsx");
  assert.ok(!/if \(!initialized \|\| !user \|\| player\)/.test(src));
  assert.match(src, /if \(!initialized \|\| !user\)/);
});

test("이메일 가입·선수 등록 모두 실명 라벨과 한글 경고를 노출한다", () => {
  for (const p of ["src/app/register/page.tsx", "src/app/my/player-setup/page.tsx"]) {
    const src = read(p);
    assert.match(src, /이름 \(실명\)/, `${p}: 실명 라벨`);
    assert.match(src, /needsKoreanNameCheck\(/, `${p}: 한글 경고`);
  }
});

console.log("signup-real-name tests passed");
