-- Kakao/Google 등 OAuth 공급자의 메타데이터 키 차이를 흡수한다.
-- 선수 실명은 이후 /onboarding → /my/player-setup에서 반드시 확인한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_gender text := nullif(meta->>'gender', '');
  v_birth  date;
  v_team   uuid;
  v_exp    boolean := false;
  v_card_skin text := coalesce(nullif(meta->>'card_skin',''), 'standard');
  v_name text := coalesce(
    nullif(meta->>'name',''),
    nullif(meta->>'full_name',''),
    nullif(meta->>'preferred_username',''),
    nullif(meta->>'user_name',''),
    nullif(meta->>'nickname',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    '회원'
  );
begin
  begin v_birth := nullif(meta->>'birth_date','')::date;            exception when others then v_birth := null; end;
  begin v_team  := nullif(meta->>'team_id','')::uuid;               exception when others then v_team  := null; end;
  begin v_exp   := coalesce(nullif(meta->>'has_player_experience','')::boolean, false);
                                                                    exception when others then v_exp  := false; end;

  if v_gender is not null and v_gender not in ('male','female','other','prefer_not_to_say') then
    v_gender := null;
  end if;

  if v_card_skin not in ('standard', 'hologram') then
    v_card_skin := 'standard';
  end if;

  insert into public.profiles (
    id, name, phone, email, gender, birth_date, has_player_experience, team_id, card_skin
  )
  values (
    new.id,
    v_name,
    nullif(meta->>'phone',''),
    new.email,
    v_gender,
    v_birth,
    v_exp,
    v_team,
    v_card_skin
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    raise warning '[handle_new_user] profile insert skipped for %: %', new.id, sqlerrm;
    return new;
end;
$$;
