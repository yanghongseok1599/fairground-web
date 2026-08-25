-- 팀 소유권(captain_id) 이전. 현재 소유자(또는 admin)가 같은 팀의 승인된 멤버에게
-- 소유권을 넘긴다. captain_id 만 변경하므로 profiles 가드 트리거를 건드리지 않는다.

-- 1) guard 트리거: 소유자 본인이 transfer RPC 로 captain_id 를 넘기는 경우 허용.
create or replace function public.guard_team_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if is_admin() or is_referee_or_admin() then
    return new;
  end if;

  if current_setting('app.claiming_team_coach', true) = '1'
     and old.captain_id is null
     and new.captain_id = auth.uid()
     and exists (
       select 1 from public.profiles me
       where me.id = auth.uid()
         and me.team_id = new.id
         and me.is_approved = true
     ) then
    return new;
  end if;

  -- 소유권 이전: 현재 소유자가 transfer_team_ownership RPC 로 본인 팀의 captain_id 를
  -- 넘기는 경우만 허용(is_approved 동반 변경은 불가).
  if current_setting('app.transferring_ownership', true) = '1'
     and old.captain_id = auth.uid()
     and new.captain_id is not null
     and new.is_approved is not distinct from old.is_approved then
    return new;
  end if;

  if new.is_approved is distinct from old.is_approved
  or new.captain_id is distinct from old.captain_id then
    raise exception 'is_approved/captain_id can only be changed by referee/admin';
  end if;
  return new;
end;
$$;

-- 2) 소유권 이전 RPC
create or replace function public.transfer_team_ownership(
  p_team_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_team  public.teams;
  v_new   public.profiles;
begin
  if v_actor is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception '팀을 찾을 수 없습니다';
  end if;

  -- 현재 소유자 또는 관리자만 이전 가능
  if not (v_team.captain_id = v_actor or is_admin()) then
    raise exception '팀 소유자만 소유권을 이전할 수 있습니다';
  end if;

  -- 새 소유자는 이 팀의 승인된 멤버여야 함
  select * into v_new from public.profiles where id = p_new_owner_id;
  if not found then
    raise exception '대상 멤버를 찾을 수 없습니다';
  end if;
  if v_new.team_id is distinct from p_team_id or coalesce(v_new.is_approved, false) = false then
    raise exception '새 소유자는 이 팀의 승인된 멤버여야 합니다';
  end if;
  if v_new.id = v_team.captain_id then
    raise exception '이미 이 팀의 소유자입니다';
  end if;

  perform set_config('app.transferring_ownership', '1', true);
  update public.teams set captain_id = p_new_owner_id where id = p_team_id;
end;
$$;

revoke all on function public.transfer_team_ownership(uuid, uuid) from public;
grant execute on function public.transfer_team_ownership(uuid, uuid) to authenticated;
