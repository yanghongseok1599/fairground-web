-- 팀 탈퇴 (본인).
-- 8/29 하드닝(guard_privileged_profile_cols / guard_team_role_change) 이후
-- profiles.team_id 직접 수정이 막히면서, 팀에 한 번 들어가면 나올 방법이 없었다.
-- 가입 신청은 무소속에게만 열려 있으므로 팀 이동도 불가능했다.
create or replace function public.leave_team()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_is_captain boolean;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;

  select team_id into v_team_id from public.profiles where id = v_uid;
  if v_team_id is null then raise exception '소속된 팀이 없습니다'; end if;

  -- 팀 대표가 나가면 팀이 주인 없는 상태가 된다. 소유권 이전이 선행돼야 한다.
  select exists (
    select 1 from public.teams where id = v_team_id and captain_id = v_uid
  ) into v_is_captain;
  if v_is_captain then
    raise exception '팀 대표는 탈퇴할 수 없습니다. 팀 관리에서 대표를 다른 멤버에게 넘긴 뒤 탈퇴해 주세요.';
  end if;

  -- team_id / team_role 직접 변경은 가드 트리거가 막는다. 인가된 워크플로임을 표시.
  perform set_config('app.in_set_team_member_role', '1', true);

  update public.profiles
     set team_id = null,
         team_role = 'member'
   where id = v_uid;

  -- 남아 있는 대기 신청은 새 팀 신청 UI 를 "신청 중"으로 묶어둔다.
  delete from public.team_join_requests
   where player_id = v_uid and status = 'pending';
end;
$$;

revoke all on function public.leave_team() from public, anon;
grant execute on function public.leave_team() to authenticated;
