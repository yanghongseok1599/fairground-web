import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

// 출전 명단이 제출되지 않은 경기에서 코트 5명을 자동으로 채울 때의 순서 규칙.
// 실제 사고: 감독(김한주, 등번호 미지정=0)이 항상 코트 1순위로 올라왔다.
//   - 가입 시 number 기본값이 0 → 숫자 정렬에서 맨 앞
//   - 감독·매니저를 스태프로 구분하지 않음
const src = readFileSync(
  join(process.cwd(), "src/app/admin/match/[matchId]/page.tsx"),
  "utf8",
);

test("등번호 0(미지정)은 맨 뒤로 정렬된다", () => {
  assert.match(src, /const jerseyOrder = \(p: Player\) =>/);
  assert.match(src, /p\.number > 0 \? p\.number : Number\.MAX_SAFE_INTEGER/);
  assert.ok(
    !/typeof a\.number === "number" \? a\.number : Number\.MAX_SAFE_INTEGER/.test(src),
    "0 을 유효 등번호로 취급하던 옛 정렬이 남아 있으면 안 된다",
  );
});

test("자동 배치는 감독·매니저를 후순위로 민다", () => {
  assert.match(src, /const byFieldPriority = \(a: Player, b: Player\) =>/);
  assert.match(src, /p\.teamRole === "coach" \|\| p\.teamRole === "manager"/);
  // 명단이 없을 때의 폴백과 로스터 채움 모두 byFieldPriority 를 써야 한다
  // (선출 제외 필터 eligible() 을 통과한 뒤 정렬된다)
  assert.match(src, /eligible\(fallbackActive\)\.sort\(byFieldPriority\)/);
  assert.match(src, /\.filter\(\(p\) => !pickedIds\.has\(p\.id\) && !registeredFillerIds\.has\(p\.id\)\)\s*\n\s*\.sort\(byFieldPriority\)/);
});

test("제외가 아니라 후순위 — 플레잉코치는 인원이 모자라면 올라온다", () => {
  // staff 를 filter 로 제거하면 5명을 못 채우는 팀에서 코트가 비어버린다.
  assert.ok(
    !/filter\(\(p\) => p\.teamRole !== "coach"\)/.test(src),
    "감독을 하드 제외하면 플레잉코치·소수 로스터 팀이 깨진다",
  );
});

console.log("court-auto-assignment tests passed");

// 규정 제22조 — 선출은 출전 불가. 감독(후순위)과 달리 예외가 없다.
const eligibilitySql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260827000000_block_registered_players_from_playing.sql"),
  "utf8",
);

test("선출은 코트·벤치 후보에서 아예 제외된다", () => {
  assert.match(src, /const eligible = \(list: Player\[\]\) => list\.filter\(\(p\) => !p\.hasPlayerExperience\)/);
  assert.match(src, /return eligible\(fallbackActive\)\.sort\(byFieldPriority\)/);
  assert.match(src, /const starters = eligible\(toPlayers\(/);
  assert.match(src, /const rosterFillers = eligible\(pool\)/);
  assert.match(src, /const rosterBench = eligible\(pool\)/);
});

test("선출 차단은 DB 에서도 강제된다 (클라이언트 필터만으로는 우회 가능)", () => {
  // 출전 명단 트리거
  assert.match(eligibilitySql, /create trigger trg_reject_registered_player_lineup/i);
  assert.match(eligibilitySql, /before insert or update on public\.match_lineups/i);
  // 이벤트 기록 가드
  assert.match(eligibilitySql, /create or replace function public\.assert_player_is_eligible/i);
  assert.match(eligibilitySql, /perform assert_player_is_eligible\(p_player_id\)/i);
  // 운영진 지정 RPC — admin 만
  assert.match(eligibilitySql, /create or replace function public\.set_player_eligibility/i);
  assert.match(eligibilitySql, /v_actor_role <> 'admin'/i);
});
