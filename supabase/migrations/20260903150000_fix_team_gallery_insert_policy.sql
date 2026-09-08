-- 팀 갤러리 업로드 정책 수정
--
-- 증상: 모든 사용자에게 팀 갤러리 업로드가 거부됐다. 오류가 남지 않아 오래 묻혀 있었다.
--
-- 원인: p_team_galleries_insert 의 EXISTS 서브쿼리가 업로드되는 객체의 경로 대신
--       profiles.name(사람 이름)을 경로로 파싱하고 있었다.
--
--         profiles.team_id = safe_uuid((storage.foldername(profiles.name))[1])
--
--       사람 이름에는 '/' 가 없으므로 storage.foldername() 이 빈 배열을 돌려주고
--       [1] 이 NULL, safe_uuid(NULL) 이 NULL 이 되어 비교가 참이 될 수 없다.
--       실측: 프로필 47건 중 이 조건을 만족할 수 있는 행 0건, 버킷 객체 0건,
--       team_gallery_photos 0행. 같은 버킷의 select/delete 정책은 올바르게
--       (storage.foldername(name))[1] 을 쓰고 있어 insert 정책만 어긋나 있었다.
--
-- 수정: 바깥 테이블을 명시적으로 한정(objects.name)하고, 서브쿼리의 profiles 에는
--       별칭 p 를 주어 컬럼 이름이 가려지지 않게 한다. 서브쿼리 안에서 한정 없는
--       name 은 안쪽 테이블에 바인딩되므로 별칭만으로는 부족하고 두 가지를 함께 해야 한다.
--
-- 검증: 개발 프로젝트(fairground-dev)에서 세 케이스를 실제로 실행해 확인했다.
--       (1) 자기 팀 폴더에 올리는 팀원 → 허용
--       (2) 다른 팀 폴더에 올리기 → 거부
--       (3) 무소속 선수가 팀 폴더에 올리기 → 거부
--
-- 되돌리기: 아래 정책을 drop 하고 profiles.name 을 쓰던 이전 정의를 재생성하면 된다.
--          다만 이전 정의는 아무도 통과시키지 못하는 상태이므로 되돌릴 이유는 없다.

drop policy if exists p_team_galleries_insert on storage.objects;

create policy p_team_galleries_insert
  on storage.objects for insert
  with check (
    bucket_id = 'team-galleries'::text
    and auth.role() = 'authenticated'::text
    and safe_uuid((storage.foldername(objects.name))[1]) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.team_id = safe_uuid((storage.foldername(objects.name))[1])
    )
  );
