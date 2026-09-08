#!/usr/bin/env bash
# FairGround — 마이그레이션 드리프트 점검
#
# 리포의 supabase/migrations/*.sql 와 원격 프로젝트의 적용 이력을 대조한다.
# 읽기 전용: 스키마도 데이터도 이력도 건드리지 않는다.
#
#   ./scripts/check-migration-drift.sh
#
# 종료 코드: 0 = 완전 일치 / 1 = 드리프트 있음 / 2 = 실행 불가
#
# 배경: 리포 이력은 원격 이력과 이름·타임스탬프가 모두 어긋나 있다.
# 근거와 복구 절차는 docs/migration-drift-audit-2026-09-03.md 참고.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2
MIG_DIR="supabase/migrations"

command -v supabase >/dev/null 2>&1 || { echo "supabase CLI 없음 — 설치 후 재시도"; exit 2; }
[ -d "$MIG_DIR" ] || { echo "$MIG_DIR 없음"; exit 2; }

REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "")
if [ -z "$REF" ]; then
  echo "원격 프로젝트에 link 되어 있지 않음 — 'supabase link' 후 재시도"
  exit 2
fi
echo "대상 프로젝트: $REF"
if [ "$REF" != "ovtnmslyjzvghirdvife" ]; then
  echo "!! 경고: Fairground(ovtnmslyjzvghirdvife)가 아닌 프로젝트에 link 되어 있습니다."
  echo "   같은 조직에 autoceo-brand-radar 등 다른 프로젝트가 있습니다. 중단합니다."
  exit 2
fi

TMP=$(mktemp -d) || exit 2
trap 'rm -rf "$TMP"' EXIT

# 원격 이력: "LOCAL | REMOTE | TIME" 표에서 REMOTE 열이 채워진 행만 채택
supabase migration list --linked 2>/dev/null \
  | awk -F'|' '$2 ~ /[0-9]{14}/ { gsub(/[^0-9]/, "", $2); if ($2 != "") print $2 }' \
  | sort -u > "$TMP/db_versions.txt"

if [ ! -s "$TMP/db_versions.txt" ]; then
  echo "원격 이력을 읽지 못했습니다 (인증 만료 또는 네트워크)."
  echo "'supabase login' 상태를 확인한 뒤 재시도하십시오."
  exit 2
fi

ls "$MIG_DIR"/*.sql 2>/dev/null | sed -E 's|.*/||; s|\.sql$||' > "$TMP/repo_files.txt"
sed -E 's/^([0-9]{14}).*/\1/' "$TMP/repo_files.txt" | sort -u > "$TMP/repo_versions.txt"

only_repo=$(comm -23 "$TMP/repo_versions.txt" "$TMP/db_versions.txt" | wc -l | tr -d ' ')
only_db=$(comm -13 "$TMP/repo_versions.txt" "$TMP/db_versions.txt" | wc -l | tr -d ' ')

echo
echo "리포 마이그레이션 $(wc -l < "$TMP/repo_versions.txt" | tr -d ' ')개 / 원격 적용 $(wc -l < "$TMP/db_versions.txt" | tr -d ' ')개"
echo
echo "── 리포에만 있는 version (${only_repo}개) — 'supabase db push' 시 적용 시도 대상 ──"
comm -23 "$TMP/repo_versions.txt" "$TMP/db_versions.txt" | while read -r v; do
  grep -m1 "^${v}" "$TMP/repo_files.txt" | sed 's/^/  /'
done
echo
echo "── 원격에만 있는 version (${only_db}개) — 리포에 파일 없음 ──"
comm -13 "$TMP/repo_versions.txt" "$TMP/db_versions.txt" | sed 's/^/  /'

echo
if [ "$only_repo" -eq 0 ] && [ "$only_db" -eq 0 ]; then
  echo "✅ 이력 일치 — db push 안전"
  exit 0
fi

cat <<'WARN'
❌ 드리프트 있음.

이 상태에서 `supabase db push` 를 실행하면 리포에만 있는 마이그레이션이
전부 재실행됩니다. 대부분 CREATE OR REPLACE FUNCTION 이므로 에러 없이
통과하면서 운영 중인 함수 본문을 리포의 옛 버전으로 덮어씁니다.
데이터 마이그레이션(mixed_futsal_home_popup)은 행을 중복 삽입합니다.

  금지: supabase db push / supabase db reset --linked / supabase migration repair
  근거: AGENTS.md:21, docs/supabase-safety.md:71
  절차: docs/migration-drift-audit-2026-09-03.md
WARN
exit 1
