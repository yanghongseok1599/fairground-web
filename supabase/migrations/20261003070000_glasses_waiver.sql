-- Immutable account-bound electronic signature; no public signature data.
create table public.glasses_waivers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete restrict,
  signer_name text not null check (length(signer_name) between 1 and 100),
  version text not null,
  document jsonb not null check (jsonb_typeof(document) = 'array'),
  signed_at timestamptz not null default now(),
  unique (player_id, version)
);
alter table public.glasses_waivers enable row level security;
revoke all on public.glasses_waivers from public, anon, authenticated;

create function public.get_my_glasses_waiver()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select to_jsonb(w) - 'player_id' from public.glasses_waivers w
    where w.player_id = auth.uid() and w.version = '2026-10-03-v1');
end;
$$;

create function public.sign_glasses_waiver(p_signer_name text, p_agreed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_saved jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_agreed is distinct from true then raise exception 'Consent required' using errcode = '22023'; end if;
  select btrim(name) into v_name from public.profiles where id = auth.uid() for share;
  if v_name is null or v_name = '' or p_signer_name is null or btrim(p_signer_name) <> v_name then
    raise exception 'Signer must match account name' using errcode = '22023';
  end if;
  insert into public.glasses_waivers (player_id, signer_name, version, document)
    values (auth.uid(), v_name, '2026-10-03-v1', jsonb_build_array('본인은 풋살 경기·훈련 중 공, 다른 참가자 또는 시설물과의 충돌로 안경이 파손되거나 안경테·렌즈에 의해 눈·얼굴 등 신체에 부상이 발생할 수 있음을 확인합니다.',
    '본인은 일반 안경을 벗거나 스포츠용 보호안경 등 안전한 대안을 선택할 수 있음을 안내받았으며, 안경을 착용한 상태로 참가하는 것은 본인의 자발적인 선택임을 확인합니다.',
    '본인은 본인의 안경 착용 선택 또는 부주의로 발생한 안경 파손과 본인의 부상에 대해 법령상 본인에게 귀속되는 책임 및 비용을 부담합니다. 주최·운영 측의 귀책사유가 없는 안경 착용 자체의 위험으로 발생한 손해에 대해서는 주최·운영 측에 책임을 묻지 않습니다.',
    '본인은 심판·운영진의 안전 지시를 따르며, 위험이 있거나 안경이 파손된 경우 즉시 경기를 중단하고 운영진에게 알리겠습니다. 이 서약은 경기 규정상 허용되지 않는 장비의 착용을 허가하는 것이 아닙니다.',
    '이 서약은 주최·운영 측 또는 다른 참가자의 고의·과실 등으로 인한 법률상 책임을 일괄 면제하거나, 법령상 배제할 수 없는 본인의 권리를 포기하는 의미가 아닙니다.',
    '본인은 위 내용을 읽고 이해했으며, 로그인한 본인 계정에서 이름을 직접 입력하고 서명 제출 버튼을 눌러 전자서명합니다. 회원 ID, 서명 이름, 서약 내용·버전 및 서명 시각이 서약 확인과 사고 발생 시 사실 확인을 위해 저장됩니다.'))
    on conflict (player_id, version) do nothing;
  select to_jsonb(w) - 'player_id' into v_saved from public.glasses_waivers w
    where w.player_id = auth.uid() and w.version = '2026-10-03-v1';
  return v_saved;
end;
$$;
revoke all on function public.get_my_glasses_waiver() from public, anon;
revoke all on function public.sign_glasses_waiver(text, boolean) from public, anon;
grant execute on function public.get_my_glasses_waiver() to authenticated;
grant execute on function public.sign_glasses_waiver(text, boolean) to authenticated;
