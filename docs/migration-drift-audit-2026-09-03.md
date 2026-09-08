# 마이그레이션 드리프트 감사 (2026-09-03)

대상: Supabase 프로젝트 **Fairground** `ovtnmslyjzvghirdvife`
방법: 전부 읽기 전용 조회. 스키마·데이터·이력 변경 없음.
점검 재실행: `./scripts/check-migration-drift.sh`

## 요약

리포 `supabase/migrations/` 47개 ↔ 원격 적용 이력 62개. 이름과 타임스탬프가
양쪽 모두에서 어긋나 있다. **리포의 마이그레이션 이력은 실제 적용 이력이 아니라
사후에 재작성된 기록**이다.

근거: 리포 파일의 타임스탬프가 `20260528000000`처럼 끝이 0으로 채워진 반면,
원격 이력은 `20260528071038`처럼 실제 실행 시각이다. 즉 SQL 에디터나
`apply_migration`으로 먼저 적용하고, 리포 파일은 나중에 손으로 작성했다.

## 대조 결과

### A. 리포에만 있는 15개 — 전부 "적용됐으나 장부에 없음"

| 마이그레이션 | 검증한 객체 | 원격 상태 |
|---|---|---|
| `admin_broadcast_push` | `admin_broadcast_count/push/recipient_ids` | 존재 |
| `admin_player_state_rpc` | `set_player_approval`, `set_player_role` | 존재 |
| `disciplinary_automation` | `end_match`, `forfeit_match` | 존재 |
| `fix_league_tier_rpc_casts` | `promote_team`, `relegate_team` | 존재 |
| `match_lifecycle_and_finalization` | `start_match`, `pause_match`, `resume_match`, `update_match_timer`, `compute_card_rating`, `recompute_team_ranks`, `team_stats_with_result` | 존재 |
| `next_match_ready_notification` | `notify_next_match_ready` | 존재 |
| `team_coach_claim_and_join_permissions` | `claim_team_coach`, `is_team_*` 5종, `guard_*` 3종, `apply_team_join_request`, `set_team_member_role` | 존재 |
| `team_onboarding_dues_flow` | `backfill_team_dues_payments_for_member`, `is_team_member` | 존재 |
| `allow_public_*` 3종 | RLS 정책 | (정책명 기준 미검증) |
| `match_event_foul` | enum `match_event_t = 'foul'` | 존재 |
| `match_ready_notification_kind` | enum `notification_kind_t = 'match_ready'` | 존재 |
| `profile_photo_locked` | 컬럼 `profiles.profile_photo_locked` | 존재 |
| `mixed_futsal_home_popup` | `site_popups` "제1회 혼성 풋살 대회" 행 | 존재 (`is_active=false`) |

함수 29개 전수 조회 결과 **MISSING 0건**.

### B. 원격에만 있는 30개

`init_schema`, `community_engine`, `activity_feed`, `push_*`, `tier_promotion*`,
`notices_and_board`, `rate_limits`, `trgm_search_indexes`,
`block_registered_players_in_match_events`, `tournament_fixtures_published_flag` 등.
리포에 대응 파일이 없다. 초기 이력이 리포 정리 과정에서 유실된 것으로 보인다.
`db push` 안전성에는 영향 없으나, 빈 DB를 리포만으로 재구성할 수 없다는 뜻이다.

### C. 이름 같고 version 다른 21개

```
auto_ejection_on_second_yellow          repo=20260826000000  db=20260826142704
block_registered_players_from_playing   repo=20260827000000  db=20260826152802
codex_security_authorization_hardening  repo=20260829020000  db=20260903032752
handle_new_user_profile_trigger         repo=20260615000000  db=20260615092213 / 20260615095119
harden_handle_new_user_casts            repo=20260616000000  db=20260615173132
league_promotion                        repo=20260528000000  db=20260528071038
league_tier_4step                       repo=20260528010000  db=20260528074013
notification_kinds_role_approval        repo=20260616020000  db=20260616033518
notify_on_approval_and_role_change      repo=20260616030000  db=20260616033553
participation_streak                    repo=20260528020000  db=20260528083645
profile_portrait_consent                repo=20260828010000  db=20260827165122
site_popups_detail_three_four           repo=20260610010000  db=20260610134840
substitution_rpc                        repo=20260529000000  db=20260529052435
team_dues                               repo=20260527000000  db=20260527093959
team_join_requests                      repo=20260526000000  db=20260525204301
team_ownership_transfer                 repo=20260616010000  db=20260616031624
team_portrait_consent                   repo=20260828000000  db=20260827164032
team_type                               repo=20260527010000  db=20260527131819
telegram_notify_new_team                repo=20260827010000  db=20260826172628
tournament_entry_fees                   repo=20260827020000  db=20260827014235
```

`codex_security_authorization_hardening` 은 오늘 MCP `apply_migration` 으로
적용되면서 원격에 `20260903032752` 로 새 타임스탬프가 찍혔다. 리포 파일명은
`20260829020000` 이므로 이 항목도 드리프트에 편입됐다.

## 지금 `supabase db push` 를 실행하면

리포에만 있는 version **35개**를 적용 시도한다. A 15개 + C 20개다
(C 표의 21행 중 `handle_new_user_profile_trigger` 는 원격에 2행이 대응하는
리포 1파일이므로 version 기준으로는 20개).

수치 기준 주의: 위 A·B·C 분류는 **이름** 기준이고, `check-migration-drift.sh`
출력은 **version** 기준이다. 그래서 스크립트의 "원격에만 있는 version"은 50개로
나온다 — B의 30개에 C의 원격 version 20개가 더해진 값이다. 같은 상태를 다른
키로 센 것이며 모순이 아니다.

1. **가장 위험** — `CREATE OR REPLACE FUNCTION` 계열은 에러 없이 통과하면서
   운영 중인 함수 본문을 리포의 옛 정의로 덮어쓴다. `end_match`, `start_match`,
   `claim_team_coach`, `guard_team_role_change` 는 여러 파일에 중복 정의되어
   있어 마지막 파일의 정의가 최종 상태가 된다.
2. `mixed_futsal_home_popup` 은 `insert` 이므로 팝업 행이 중복 생성된다.
3. `create policy` 는 `if not exists` 를 못 쓰므로 중복 시 에러로 푸시가 중단된다 —
   1·2가 이미 실행된 뒤 중간에 멈출 수 있다.

## 오탐 정정

앞선 세션이 보고한 **"릴레이션 `team`(단수) MISSING"** 은 오탐이다. 실제 릴레이션은
`public.teams`(복수)이며 존재한다. 코드에도 `.from('team')` 단수 참조가 없다.
`.from('team...')` 패턴 grep이 접두사만 잘라낸 결과로 보인다.

## 복구 절차 (미실행 — 승인 필요)

`docs/supabase-safety.md:71` 은 `migration repair` 를 **"실제 스키마가 동일하다는
증거가 확보된 뒤"** 허용한다. 이 문서의 A 절이 그 증거의 대부분이나, 아직 남은
공백이 있다.

**남은 증거 공백:** 객체의 *존재* 만 확인했고 *정의 본문 일치* 는 확인하지 않았다.
함수가 존재하더라도 원격 본문이 리포 파일과 다를 수 있다. repair 를 하면 그 차이는
영구히 "적용됨"으로 봉인된다.

1. **본문 대조** — A·C 목록 함수의 `pg_get_functiondef()` 결과를 리포 파일의
   정의와 비교한다. 차이가 나면 어느 쪽이 최신인지 판정한다.
2. **기준선 생성** — `supabase db pull` 로 현재 원격 스키마를 단일 기준선
   마이그레이션으로 뽑는다. B 절(리포에 없는 30개)이 이 단계에서 해소된다.
3. **이력 정합** — 기준선 이전의 리포 파일 version 을
   `supabase migration repair --status applied <version>` 으로 표시한다.
   스키마·데이터는 건드리지 않고 장부만 맞춘다. `--status reverted` 로 되돌릴 수 있다.
4. **검증** — `./scripts/check-migration-drift.sh` 가 0을 반환하는지 확인한다.
5. **문서 갱신** — `AGENTS.md:21` 과 `docs/supabase-safety.md` 의 금지 조항을
   해제 상태로 갱신한다.

1번을 마치기 전까지 3번을 실행하지 않는다.

## 재발 방지

- `./scripts/check-migration-drift.sh` — 읽기 전용 점검. 링크된 프로젝트가
  Fairground 가 아니면 즉시 중단한다(조직에 `autoceo-brand-radar` 등 타 프로젝트 존재).
- 운영 DB에 DDL을 적용할 때 SQL 에디터나 MCP `apply_migration` 을 쓰면 원격에만
  기록이 남아 드리프트가 재생산된다. 리포에 파일을 먼저 만들고 그 파일명 그대로
  적용하는 경로만 사용한다.
