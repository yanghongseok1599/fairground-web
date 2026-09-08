-- 팀 대표가 "승인 대기" 상태에서 자기 팀 정보를 수정하지 못하던 문제.
--
-- p_teams_update_captain 이 is_approved = true 를 요구해서, 팀을 막 등록한 대표는
-- 이름/로고/창단연도/소개를 고칠 수 없었다. PostgREST 는 RLS 로 걸린 UPDATE 를
-- 에러가 아니라 "0행 갱신"으로 돌려주므로 화면에는 아무 일도 일어나지 않았다.
--
-- is_approved / captain_id 는 guard_team_privileged_cols 트리거가 여전히 막으므로
-- 대표가 스스로 승인하거나 소유권을 바꿀 수는 없다.
drop policy if exists "p_teams_update_captain" on public.teams;

create policy "p_teams_update_captain"
on public.teams
for update
using (captain_id = auth.uid())
with check (captain_id = auth.uid());
