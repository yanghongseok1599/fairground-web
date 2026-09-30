-- Fail closed on nullable authorization; internal eligibility helper is not an API.
begin;

create or replace function public.set_team_member_role(p_player_id uuid, p_team_role team_role_t)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_is_owner boolean := false;
begin
  if v_actor_id is null then raise exception '로그인이 필요합니다'; end if;
  if p_team_role is null then raise exception '팀 역할이 필요합니다'; end if;

  select * into v_actor from public.profiles where id = v_actor_id;
  if not found then raise exception '현재 사용자를 찾을 수 없습니다'; end if;

  select * into v_target from public.profiles where id = p_player_id;
  if not found then raise exception '대상 멤버를 찾을 수 없습니다'; end if;
  if v_target.team_id is null then raise exception '대상 멤버가 팀에 속해 있지 않습니다'; end if;
  if v_actor_id = p_player_id then raise exception '본인 역할은 직접 변경할 수 없습니다'; end if;

  select exists (
    select 1 from public.teams t where t.id = v_target.team_id and t.captain_id = v_actor_id
  ) into v_is_owner;

  if (
    v_actor.role = 'admin'
    or (v_actor.is_approved = true and v_is_owner)
    or (v_actor.is_approved = true and v_actor.team_id = v_target.team_id
        and v_actor.team_role in ('coach', 'manager'))
  ) is not true then
    raise exception '팀 역할 변경 권한이 없습니다';
  end if;

  if v_actor.role <> 'admin' and not v_is_owner and v_actor.team_id is distinct from v_target.team_id then
    raise exception '다른 팀 멤버의 역할은 변경할 수 없습니다';
  end if;

  if v_actor.role <> 'admin' and not v_is_owner and v_actor.team_role = 'manager'
     and (p_team_role = 'coach' or v_target.team_role = 'coach') then
    raise exception '매니저는 감독 권한을 부여하거나 회수할 수 없습니다';
  end if;

  perform set_config('app.in_set_team_member_role', '1', true);

  update public.profiles
    set team_role = p_team_role, is_approved = true
    where id = p_player_id;

  if p_team_role is distinct from v_target.team_role then
    begin
      insert into public.notifications (user_id, kind, title, snippet, actor_id, team_id)
      select p_player_id, 'team_role_changed', '팀 역할이 변경되었어요',
             coalesce(t.name, '팀') || '에서 역할이 ' ||
             case p_team_role
               when 'coach' then '감독' when 'manager' then '매니저'
               when 'captain' then '캡틴' else '멤버' end ||
             '(으)로 변경되었습니다.', v_actor_id, v_target.team_id
      from public.teams t where t.id = v_target.team_id;
    exception when others then raise warning '[notify role] %', sqlerrm; end;
  end if;
end;
$function$;


revoke all on function public.set_team_member_role(uuid, public.team_role_t) from public, anon;
grant execute on function public.set_team_member_role(uuid, public.team_role_t) to authenticated;

create or replace function public.set_player_eligibility(
  p_player_id uuid,
  p_is_registered_player boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.player_role_t;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select role into v_actor_role from public.profiles where id = auth.uid();
  if v_actor_role is distinct from 'admin' then
    raise exception '참가 자격 변경 권한이 없습니다';
  end if;

  update public.profiles
    set has_player_experience = coalesce(p_is_registered_player, false)
    where id = p_player_id;

  if not found then
    raise exception '대상 선수를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.set_player_eligibility(uuid, boolean) from public;
grant execute on function public.set_player_eligibility(uuid, boolean) to authenticated;


revoke all on function public.assert_player_is_eligible(uuid) from public, anon, authenticated;

commit;
