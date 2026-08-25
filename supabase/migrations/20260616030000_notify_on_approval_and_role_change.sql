-- 선수 승인 / 팀 역할 변경 / 소유권 이전 시 notifications insert → trg_push_dispatch 가
-- 자동으로 web push 발사. 알림 insert 는 예외 가드로 감싸 핵심 동작을 막지 않는다.

-- 1) 관리자 선수 승인 (false→true 시에만 알림)
create or replace function public.set_player_approval(p_player_id uuid, p_is_approved boolean)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_actor_role public.player_role_t;
  v_was boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select role into v_actor_role from public.profiles where id = auth.uid();
  if v_actor_role <> 'admin' then
    raise exception '선수 승인 권한이 없습니다';
  end if;

  select is_approved into v_was from public.profiles where id = p_player_id;

  update public.profiles set is_approved = p_is_approved where id = p_player_id;
  if not found then
    raise exception '대상 선수를 찾을 수 없습니다';
  end if;

  if p_is_approved and coalesce(v_was, false) = false and p_player_id <> auth.uid() then
    begin
      insert into public.notifications (user_id, kind, title, snippet, actor_id)
      values (p_player_id, 'player_approved', '가입이 승인되었어요',
              '이제 모든 기능을 사용할 수 있습니다.', auth.uid());
    exception when others then raise warning '[notify approval] %', sqlerrm; end;
  end if;
end;
$function$;

-- 2) 팀 가입 신청 승인 (트리거)
create or replace function public.apply_team_join_request()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    perform set_config('app.applying_team_join_request', '1', true);

    update public.profiles
      set team_id = new.team_id,
          is_approved = true,
          team_role = coalesce(team_role, 'member'::public.team_role_t)
      where id = new.player_id;

    new.processed_at = now();
    new.processed_by = auth.uid();

    begin
      insert into public.notifications (user_id, kind, title, snippet, actor_id, team_id)
      select new.player_id, 'player_approved', '팀 가입이 승인되었어요',
             coalesce(t.name, '팀') || ' 가입이 승인되었습니다.', auth.uid(), new.team_id
      from public.teams t where t.id = new.team_id;
    exception when others then raise warning '[notify join] %', sqlerrm; end;
  elsif new.status = 'rejected' and (old.status is null or old.status <> 'rejected') then
    new.processed_at = now();
    new.processed_by = auth.uid();
  end if;
  return new;
end;
$function$;

-- 3) 팀 역할 변경 (실제 변경된 경우만 알림)
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

  if not (
    v_actor.role = 'admin'
    or (v_actor.is_approved = true and v_is_owner)
    or (v_actor.is_approved = true and v_actor.team_id = v_target.team_id
        and v_actor.team_role in ('coach', 'manager'))
  ) then
    raise exception '팀 역할 변경 권한이 없습니다';
  end if;

  if v_actor.role <> 'admin' and not v_is_owner and v_actor.team_id <> v_target.team_id then
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

-- 4) 팀 소유권 이전 (새 소유자에게 알림)
create or replace function public.transfer_team_ownership(p_team_id uuid, p_new_owner_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_team  public.teams;
  v_new   public.profiles;
begin
  if v_actor is null then raise exception '로그인이 필요합니다'; end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then raise exception '팀을 찾을 수 없습니다'; end if;

  if not (v_team.captain_id = v_actor or is_admin()) then
    raise exception '팀 소유자만 소유권을 이전할 수 있습니다';
  end if;

  select * into v_new from public.profiles where id = p_new_owner_id;
  if not found then raise exception '대상 멤버를 찾을 수 없습니다'; end if;
  if v_new.team_id is distinct from p_team_id or coalesce(v_new.is_approved, false) = false then
    raise exception '새 소유자는 이 팀의 승인된 멤버여야 합니다';
  end if;
  if v_new.id = v_team.captain_id then
    raise exception '이미 이 팀의 소유자입니다';
  end if;

  perform set_config('app.transferring_ownership', '1', true);
  update public.teams set captain_id = p_new_owner_id where id = p_team_id;

  begin
    insert into public.notifications (user_id, kind, title, snippet, actor_id, team_id)
    values (p_new_owner_id, 'team_role_changed', '팀 소유권을 넘겨받았어요',
            coalesce(v_team.name, '팀') || '의 소유자가 되었습니다. 팀 정보·운영형태를 변경할 수 있어요.',
            v_actor, p_team_id);
  exception when others then raise warning '[notify transfer] %', sqlerrm; end;
end;
$function$;
