import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const adminMatchPage = readFileSync(
  join(root, "src/app/admin/match/[matchId]/page.tsx"),
  "utf8",
);

test("경기 종료 모달은 심판 MOM 선택 또는 MOM 없음 명시 후 종료할 수 있다", () => {
  assert.match(adminMatchPage, /const NO_MOM_VALUE = "__no_mom__"/);
  assert.match(adminMatchPage, /const \[endMomChoice, setEndMomChoice\] = useState\(""\)/);
  assert.match(adminMatchPage, /MOM 선수 또는 MOM 없음 중 하나를 선택해야 경기를 종료할 수 있습니다\./);
  assert.match(adminMatchPage, /disabled=\{mc\.pendingAction !== null \|\| !endMomReady\}/);
});

test("선택한 MOM은 경기 종료 전에 먼저 저장한다", () => {
  assert.match(adminMatchPage, /const momChoice = endMomChoice \|\| matchData\.momPlayerId \|\| ""/);
  assert.match(adminMatchPage, /momChoice !== NO_MOM_VALUE/);
  assert.match(adminMatchPage, /const ok = await mc\.setMom\(momChoice\)/);
  assert.match(adminMatchPage, /await mc\.endMatch\(\)/);
});

test("종료 확인에는 어시스트 누락 가능성을 경고한다", () => {
  // 계산식 자체를 정규식으로 못박지 않는다. 누락 판정이 전역 개수 차이에서
  // 팀별 매칭(uncheckedAssistGoals)으로 개선되면서 식이 바뀌었고, 앞으로도
  // 바뀔 수 있다. 종료 확인에 필요한 값이 정의돼 있는지와, 심판이 실제로 보는
  // 경고 문구가 남아 있는지를 확인한다.
  assert.match(adminMatchPage, /const goalEventCount = /);
  assert.match(adminMatchPage, /const assistEventCount = /);
  assert.match(adminMatchPage, /const missingAssistCount = /);
  assert.match(adminMatchPage, /골 \{goalEventCount\}개, 어시스트 \{assistEventCount\}개입니다/);
  assert.match(adminMatchPage, /어시스트 누락이 있으면 종료 전에 관리자 기록을 확인하세요/);
});

console.log("match-end-mom-confirmation tests passed");
