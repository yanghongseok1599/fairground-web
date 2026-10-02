-- 경기 명단은 팀 직책이 아니라 기존 참가 자격으로 판단한다.
-- 공개 카드의 노출 범위를 유지하며 선수 출신만 경기 명단에서 제외한다.
-- 감독/주장/매니저도 참가 자격이 있으면 선수로 함께 출전할 수 있다.
create view public.public_match_player_profiles
with (security_barrier = true) as
select visible.*
from public.public_player_profiles visible
join public.profiles eligibility on eligibility.id = visible.id
where not coalesce(eligibility.has_player_experience, false);

revoke all on public.public_match_player_profiles from public, anon, authenticated;
grant select on public.public_match_player_profiles to anon, authenticated;
comment on view public.public_match_player_profiles is
  '공개 선수 정보 중 참가 자격을 충족한 경기 명단. 팀 직책은 출전 제외 조건이 아님.';
