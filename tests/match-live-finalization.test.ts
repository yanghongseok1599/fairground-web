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
