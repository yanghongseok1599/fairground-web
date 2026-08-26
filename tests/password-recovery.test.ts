import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const store = read("src/stores/authStore.ts");

test("짧은 ID(@fairground.local) 계정은 재설정 메일을 보내지 않고 안내한다", () => {
  // 이 계정들의 auth 이메일은 실제 주소가 아니라 메일이 닿지 않는다.
  // 조용히 성공 처리하면 사용자가 오지 않는 메일을 기다리게 된다.
  assert.match(store, /if \(email\.endsWith\(`@\$\{SHORT_ID_DOMAIN\}`\)\)/);
  assert.match(store, /운영진에게 문의해주세요/);
  // 안내가 resetPasswordForEmail 호출보다 앞에 있어야 한다
  const guard = store.indexOf("SHORT_ID_DOMAIN}`)");
  const call = store.indexOf("resetPasswordForEmail");
  assert.ok(guard > 0 && call > guard, "짧은 ID 가드가 메일 발송보다 먼저여야 한다");
});

test("재설정 링크는 정식 도메인의 /auth/reset-password 로 돌아온다", () => {
  assert.match(store, /new URL\("\/auth\/reset-password", getAuthRedirectOrigin\(\)\)/);
});

test("비밀번호는 8자 이상만 저장된다", () => {
  assert.match(store, /if \(password\.length < 8\) throw new Error/);
});

test("찾기·재설정·변경 진입점이 모두 존재한다", () => {
  assert.match(read("src/app/login/page.tsx"), /href="\/auth\/forgot-password"/);
  assert.match(read("src/app/auth/forgot-password/page.tsx"), /requestPasswordReset\(/);
  assert.match(read("src/app/auth/reset-password/page.tsx"), /updatePassword\(/);
  assert.match(read("src/app/my/page.tsx"), /비밀번호 변경하기/);
});

console.log("password-recovery tests passed");
