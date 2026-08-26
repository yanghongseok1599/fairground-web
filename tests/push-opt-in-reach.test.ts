import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

// 구독자가 39명 중 2명에 그친 원인: 모바일에 알림을 켤 상시 진입점이 없었다.
//   - 헤더 종 토글(PushOptInButton)은 site-header 의 `hidden xl:flex` 안 → 데스크톱 전용
//   - 하단 배너(PushOptInPrompt)는 닫으면 그 방문 동안 다시 뜨지 않음
test("마이페이지에 닫히지 않는 알림 설정이 있다", () => {
  const src = read("src/app/my/page.tsx");
  assert.match(src, /import \{ PushEnableCard \}/);
  assert.match(src, /\{user && <PushEnableCard \/>\}/);
});

test("참가 신청 완료 화면에서 알림을 유도한다", () => {
  const src = read("src/app/mixed-futsal/apply/mixed-futsal-apply-client.tsx");
  assert.match(src, /import \{ PushEnableCard \}/);
  assert.match(src, /<PushEnableCard \/>/);
});

test("카드는 상태별로 다음 행동을 안내한다", () => {
  const src = read("src/components/push-enable-card.tsx");
  // iOS 미설치는 PushManager 가 없어 '미지원'으로 잡히지만, 실제로는 설치하면 된다
  assert.match(src, /홈 화면에 추가/);
  // 브라우저 차단 상태는 버튼을 눌러도 켤 수 없으므로 해제 방법을 알려야 한다
  assert.match(src, /알림이 차단되어 있습니다/);
  // 켜기/끄기 양방향
  assert.match(src, /unsubscribeAndDelete\(\)/);
  assert.match(src, /subscribeAndSave\(\)/);
  // 닫기 버튼이 없어야 한다 — 상시 진입점이 목적
  assert.ok(!/dismiss|sessionStorage/.test(src), "상시 카드는 닫기·세션 숨김이 없어야 한다");
});

console.log("push-opt-in-reach tests passed");
