-- 회원가입 견고화: 클라이언트의 profiles INSERT(세션·RLS 의존)를 폐기하고
-- auth.users INSERT 시 SECURITY DEFINER 트리거가 프로필을 생성한다.
-- 이로써 "Confirm email" 설정/세션 유무와 무관하게 프로필이 항상 만들어진다.
-- (이전엔 세션 없는 signUp 직후의 클라이언트 INSERT가 profiles RLS에 막혀
--  "new row violates row-level security policy for table profiles" 로 가입 실패.)
-- 사용자 입력값(name/phone/gender/birth_date/has_player_experience/team_id)은
-- signUp options.data → raw_user_meta_data 로 전달된다. 나머지 컬럼은 테이블 기본값
-- (role=player, card_type=gold, card_rating=70, is_approved=false, 통계=0).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_gender text := nullif(meta->>'gender', '');
  v_birth  date;
  v_team   uuid;
begin
  -- 안전 캐스팅 (빈 문자열/오류 → null)
  begin v_birth := nullif(meta->>'birth_date','')::date; exception when others then v_birth := null; end;
  begin v_team  := nullif(meta->>'team_id','')::uuid;     exception when others then v_team  := null; end;
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
    coalesce((meta->>'has_player_experience')::boolean, false),
    v_team
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
