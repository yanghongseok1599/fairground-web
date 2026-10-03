import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = process.cwd();
const kindSql = readFileSync(
  join(root, "supabase/migrations/20260725010000_match_ready_notification_kind.sql"),
  "utf8",
);
const notifySql = readFileSync(
  join(root, "supabase/migrations/20260725010100_next_match_ready_notification.sql"),
  "utf8",
);
const automaticNotifySql = readFileSync(
  join(root, "supabase/migrations/20261003060000_two_stage_next_match_ready.sql"),
  "utf8",
);
const hookTs = readFileSync(join(root, "src/hooks/useMatchControl.ts"), "utf8");
const storeTs = readFileSync(join(root, "src/stores/dataStore.ts"), "utf8");
const typesTs = readFileSync(join(root, "src/types/index.ts"), "utf8");
const mapperTs = readFileSync(join(root, "src/lib/mappers.ts"), "utf8");
const panelTs = readFileSync(join(root, "src/components/notification-panel.tsx"), "utf8");

test("다음 경기 준비 알림 타입은 별도 마이그레이션으로 추가된다", () => {
  assert.match(kindSql, /alter type public\.notification_kind_t add value if not exists 'match_ready'/i);
});

test("기존 다음 경기 준비 마이그레이션은 경기 연결과 중복 방지 이력을 보존한다", () => {
  assert.match(notifySql, /add column if not exists match_id uuid references public\.matches\(id\)/i);
  assert.match(notifySql, /create unique index if not exists notifications_match_ready_once_idx/i);
  assert.match(notifySql, /create or replace function public\.notify_next_match_ready/i);
  assert.match(notifySql, /if not public\.is_referee_or_admin\(\) then/i);
  assert.match(notifySql, /row_number\(\) over/i);
  assert.match(notifySql, /om\.status = 'scheduled'/i);
  assert.match(notifySql, /insert into public\.notifications/i);
  assert.match(notifySql, /'match_ready'::public\.notification_kind_t/i);
  assert.match(notifySql, /p\.team_id in \(v_next\.home_team_id, v_next\.away_team_id\)/i);
  assert.match(notifySql, /and n\.match_id = v_next\.id/i);
  assert.match(notifySql, /on conflict do nothing/i);
  assert.match(notifySql, /notify pgrst, 'reload schema'/i);
});

test("경기 화면은 준비 알림을 직접 발송하지 않고 경기 시간만 저장한다", () => {
  assert.doesNotMatch(hookTs, /NEXT_MATCH_READY_NOTICE|nextMatchReadyNoticeSentRef|notifyNextMatchReady/);
  assert.match(hookTs, /updateTimer\(matchId, seconds, half\)/);
  assert.match(hookTs, /syncCounterRef\.current >= 5/);
});

test("서버 자동 알림은 경기 상태 저장을 관찰하고 내부 발송 함수를 API에 노출하지 않는다", () => {
  assert.match(automaticNotifySql, /after update of status, elapsed_seconds, is_running on public\.matches/i);
  assert.match(automaticNotifySql, /old\.status = 'scheduled' and new\.status = 'live'/i);
  assert.match(automaticNotifySql, /new\.elapsed_seconds >= 420 and new\.elapsed_seconds < 720/i);
  for (const signature of ["emit_next_match_ready\\(uuid, text\\)", "dispatch_due_next_match_ready\\(\\)"]) {
    assert.match(automaticNotifySql, new RegExp(`revoke all on function public\\.${signature}\\s+from public, anon, authenticated, service_role`, "i"));
  }
  assert.match(automaticNotifySql, /auth\.uid\(\) is null or not exists/);
  assert.match(automaticNotifySql, /p\.is_approved = true and p\.role in \('referee', 'admin'\)/);
});

test("클라이언트 알림 타입과 패널은 경기 알림을 경기 상세로 연결한다", () => {
  assert.match(storeTs, /notifyNextMatchReady: \(matchId: string\) => Promise<number>/i);
  assert.match(storeTs, /supabase\.rpc\("notify_next_match_ready"/i);
  assert.match(typesTs, /"match_ready"/i);
  assert.match(typesTs, /matchId\?: string/i);
  assert.match(mapperTs, /matchId: r\.match_id \?\? undefined/i);
  assert.match(panelTs, /href=\{notificationTarget\(n\)\}/);
});

console.log("next-match-ready-notification tests passed");
