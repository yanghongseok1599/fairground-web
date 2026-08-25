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
const hookTs = readFileSync(join(root, "src/hooks/useMatchControl.ts"), "utf8");
const storeTs = readFileSync(join(root, "src/stores/dataStore.ts"), "utf8");
const typesTs = readFileSync(join(root, "src/types/index.ts"), "utf8");
const mapperTs = readFileSync(join(root, "src/lib/mappers.ts"), "utf8");
const panelTs = readFileSync(join(root, "src/components/notification-panel.tsx"), "utf8");

test("다음 경기 준비 알림 타입은 별도 마이그레이션으로 추가된다", () => {
  assert.match(kindSql, /alter type public\.notification_kind_t add value if not exists 'match_ready'/i);
});

test("다음 경기 준비 알림 RPC는 다음 scheduled 경기 양 팀에게 한 번만 발송한다", () => {
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

test("경기 타이머는 종료 10분 전 다음 경기 준비 알림 RPC를 호출한다", () => {
  assert.match(hookTs, /NEXT_MATCH_READY_NOTICE_SECONDS_BEFORE_END = 10 \* 60/i);
  assert.match(hookTs, /MATCH_DURATION_SECONDS - NEXT_MATCH_READY_NOTICE_SECONDS_BEFORE_END/i);
  assert.match(hookTs, /nextMatchReadyNoticeSentRef/i);
  assert.match(hookTs, /store\.notifyNextMatchReady\(matchId\)/i);
});

test("클라이언트 알림 타입과 패널은 경기 알림을 경기 상세로 연결한다", () => {
  assert.match(storeTs, /notifyNextMatchReady: \(matchId: string\) => Promise<number>/i);
  assert.match(storeTs, /supabase\.rpc\("notify_next_match_ready"/i);
  assert.match(typesTs, /"match_ready"/i);
  assert.match(typesTs, /matchId\?: string/i);
  assert.match(mapperTs, /matchId: r\.match_id \?\? undefined/i);
  assert.match(panelTs, /n\.kind === "match_ready" && n\.matchId/i);
  assert.match(panelTs, /`\/matches\/\$\{n\.matchId\}`/i);
});

console.log("next-match-ready-notification tests passed");
