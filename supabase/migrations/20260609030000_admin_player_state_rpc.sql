create or replace function public.set_player_approval(
  p_player_id uuid,
  p_is_approved boolean
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

  select role into v_actor_role
  from public.profiles
  where id = auth.uid();

  if v_actor_role <> 'admin' then
    raise exception '선수 승인 권한이 없습니다';
  end if;

  update public.profiles
    set is_approved = p_is_approved
    where id = p_player_id;

  if not found then
    raise exception '대상 선수를 찾을 수 없습니다';
  end if;
end;
$$;

create or replace function public.set_player_role(
  p_player_id uuid,
  p_role public.player_role_t
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

  if p_role is null then
    raise exception '역할이 필요합니다';
  end if;

  select role into v_actor_role
  from public.profiles
  where id = auth.uid();

  if v_actor_role <> 'admin' then
    raise exception '선수 역할 변경 권한이 없습니다';
  end if;

  update public.profiles
    set role = p_role
    where id = p_player_id;

  if not found then
    raise exception '대상 선수를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.set_player_approval(uuid, boolean) from public;
revoke all on function public.set_player_role(uuid, public.player_role_t) from public;

grant execute on function public.set_player_approval(uuid, boolean) to authenticated;
grant execute on function public.set_player_role(uuid, public.player_role_t) to authenticated;
