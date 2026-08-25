-- 강화: 모든 메타데이터 캐스팅을 예외 가드로 감싸 어떤 입력에도 트리거가 raise하지
-- 않게 한다(트리거 raise = signUp 전체 실패). has_player_experience 빈문자열/이상값 방어 +
-- 최후 예외 핸들러로 어떤 경우에도 가입(auth.users insert) 자체는 막지 않는다.
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
begin
  begin v_birth := nullif(meta->>'birth_date','')::date;            exception when others then v_birth := null; end;
  begin v_team  := nullif(meta->>'team_id','')::uuid;               exception when others then v_team  := null; end;
  begin v_exp   := coalesce(nullif(meta->>'has_player_experience','')::boolean, false);
                                                                    exception when others then v_exp  := false; end;
  if v_gender is not null and v_gender not in ('male','female','other','prefer_not_to_say') then
    v_gender := null;
  end if;

  insert into public.profiles (id, name, phone, email, gender, birth_date, has_player_experience, team_id)
  values (
    new.id,
    coalesce(nullif(meta->>'name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), '회원'),
    nullif(meta->>'phone',''),
    new.email,
    v_gender,
    v_birth,
    v_exp,
    v_team
  )
  on conflict (id) do nothing;

  return new;
exception
  -- 최후 방어: 어떤 예기치 못한 오류도 가입을 막지 않는다.
  -- 프로필 누락 시 init()의 onAuthStateChange 자동생성이 다음 세션에 복구한다.
  when others then
    raise warning '[handle_new_user] profile insert skipped for %: %', new.id, sqlerrm;
    return new;
end;
$$;
