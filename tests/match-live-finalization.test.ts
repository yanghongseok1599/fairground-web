import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const eventRpcSql = readFileSync(
  join(root, "supabase/migrations/20260607000000_match_event_rpc.sql"),
  "utf8",
);
const finalizationSql = readFileSync(
  join(root, "supabase/migrations/20260725000000_match_lifecycle_and_finalization.sql"),
  "utf8",
);

test("라이브 이벤트 기록은 경기 행 잠금과 같은 트랜잭션에서 처리된다", () => {
  assert.match(eventRpcSql, /create or replace function public\.add_match_event/i);
  assert.match(eventRpcSql, /select \* into m from matches where id = p_match_id for update/i);
  assert.match(eventRpcSql, /m\.status <> 'live'/i);
  assert.match(eventRpcSql, /insert into match_events/i);
  assert.match(eventRpcSql, /if p_type = 'goal'::match_event_t then/i);
  assert.match(eventRpcSql, /home_score = case when p_team_id = home_team_id/i);
  assert.match(eventRpcSql, /away_score = case when p_team_id = away_team_id/i);
});

test("경기 시작/중단/재개/타이머 동기화는 referee-admin RPC만 통과한다", () => {
  for (const fn of ["start_match", "pause_match", "resume_match", "update_match_timer"]) {
    assert.match(finalizationSql, new RegExp(`create or replace function public\\.${fn}`, "i"));
  }

  assert.match(finalizationSql, /only referee\/admin may start a match/i);
  assert.match(finalizationSql, /only referee\/admin may pause a match/i);
  assert.match(finalizationSql, /only referee\/admin may resume a match/i);
  assert.match(finalizationSql, /only referee\/admin may update match timer/i);
  assert.match(finalizationSql, /select \* into m from public\.matches where id = p_match_id for update/i);
  assert.match(finalizationSql, /elapsed_seconds = least\(720, greatest\(0, coalesce\(p_elapsed_seconds, 0\)\)\)/i);
});

test("경기 종료는 선수 통계와 카드 레이팅을 한 번만 반영한다", () => {
  assert.match(finalizationSql, /create or replace function public\.end_match/i);
  assert.match(finalizationSql, /if m\.stats_applied or m\.status = 'finished' then\s+return;/i);
  assert.match(finalizationSql, /games = games \+ 1/i);
  assert.match(finalizationSql, /goals = goals \+ r\.g/i);
  assert.match(finalizationSql, /assists = assists \+ r\.a/i);
  assert.match(finalizationSql, /mom = mom \+ \(case when r\.got_mom then 1 else 0 end\)/i);
  assert.match(finalizationSql, /card_rating = public\.compute_card_rating/i);
  assert.match(finalizationSql, /status = 'finished'/i);
  assert.match(finalizationSql, /stats_applied = true/i);
});

test("경기 종료는 팀 리그 스탯과 순위도 갱신한다", () => {
  assert.match(finalizationSql, /public\.team_stats_with_result/i);
  assert.match(finalizationSql, /'points'/i);
  assert.match(finalizationSql, /'wins'/i);
  assert.match(finalizationSql, /'draws'/i);
  assert.match(finalizationSql, /'losses'/i);
  assert.match(finalizationSql, /'goalsFor'/i);
  assert.match(finalizationSql, /'goalsAgainst'/i);
  assert.match(finalizationSql, /'goalDifference'/i);
  assert.match(finalizationSql, /'gamesPlayed'/i);
  assert.match(finalizationSql, /perform public\.recompute_team_ranks\(\)/i);
});

console.log("match-live-finalization tests passed");

// 제12조③ — 경고 2회 누적 시 퇴장은 클라이언트가 아니라 add_match_event RPC 가
// 같은 트랜잭션에서 판정한다. 클라이언트 판정은 방금 넣은 경고가 realtime 으로
// 반영됐는지 알 수 없어 첫 경고에서 오판할 수 있다.
const autoEjectionSql = readFileSync(
  join(root, "supabase/migrations/20260826000000_auto_ejection_on_second_yellow.sql"),
  "utf8",
);
const matchControlSrc = readFileSync(join(root, "src/hooks/useMatchControl.ts"), "utf8");

test("경고 2회 누적 퇴장은 add_match_event 트랜잭션 안에서 판정된다", () => {
  assert.match(autoEjectionSql, /create or replace function public\.add_match_event/i);
  assert.match(autoEjectionSql, /select \* into m from matches where id = p_match_id for update/i);
  // 방금 삽입한 경고까지 세고, 취소된 경고는 제외한다
  assert.match(autoEjectionSql, /if p_type = 'yellow_card'::match_event_t then/i);
  assert.match(autoEjectionSql, /and type = 'yellow_card'::match_event_t\s*\n\s*and not is_cancelled/i);
  assert.match(autoEjectionSql, /if v_yellow_count >= 2 and not exists/i);
  // 이미 퇴장 기록이 있으면 중복 발급하지 않는다
  assert.match(autoEjectionSql, /and type = 'red_card'::match_event_t\s*\n\s*and not is_cancelled/i);
  assert.match(autoEjectionSql, /values \(p_match_id, 'red_card'::match_event_t/i);
});

test("클라이언트 훅은 퇴장을 스스로 판정하지 않는다", () => {
  assert.ok(
    !/type: "red_card"/.test(matchControlSrc),
    "useMatchControl 이 red_card 를 직접 기록하면 realtime 타이밍에 따라 오판한다",
  );
  assert.ok(
    !/autoEjection/.test(matchControlSrc),
    "자동 퇴장 상태는 RPC 결과(events)에서 파생해야 한다",
  );
});
