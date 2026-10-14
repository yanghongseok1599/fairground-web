# 로컬 DB 회귀검증

`run-database-tests.mjs`는 PostgreSQL 17의 **빈 개발 스키마 복원본**을 파일마다 복제하고 검사 후 해당 복제 DB를 삭제한다. 애플리케이션 `.env` 파일은 읽지 않으며, hosted DB 주소·암묵적 포트·연결 옵션을 거절한다. 운영 DB에는 연결하지 않는다.

준비한 로컬 클러스터의 `postgres` 관리자 연결과 `fg_test_` 접두사의 템플릿 DB를 명시한다. 템플릿에는 검증 대상 개발 정의·소유자·역할·권한·RLS·트리거를 그대로 복원하고 `public/auth/storage` 데이터는 넣지 않는다. 저장소의 과거 마이그레이션만으로 빈 스키마를 재구성하지 않는다.

```sh
node scripts/testing/run-database-tests.mjs \
  --url postgresql://postgres@127.0.0.1:LOCAL_PORT/postgres \
  --template fg_test_current_dev
```

- 각 파일을 별도 DB에서 순차 실행하므로 순위 재계산, 커밋된 합성 회원, 장애 주입 트리거가 다른 파일에 영향을 주지 않는다.
- 최소 초상권·퀴즈 마이그레이션 테스트는 `template0` 기반의 빈 DB를 사용한다. 설문 테스트는 복원본의 적용 완료 모드로 실행한다.
- 보안 SQL 회귀검증은 자체 임시 클러스터를 생성한다. PG17 도구는 `/opt/homebrew/opt/postgresql@17/bin`에서 사용한다.
- 준비 알림 테스트는 실제 중지 상태를 먼저 확인한 뒤 해당 복제 DB에서만 기존 발송 로직을 검사하고 다시 중지한다. hosted 예약 작업을 활성화하지 않는다.
- `--files filename.test.mjs,other.test.mjs`로 관련 검사만 재실행하거나 `--exclude filename.test.mjs`로 별도 검증할 파일을 명시할 수 있다. 요약에 선택·제외 파일 수와 각 결과가 출력된다. 전체 완료 보고에는 제외한 검사의 별도 결과도 포함해야 한다.

테스트 실패를 없애기 위해 복원본의 함수·권한을 과거 버전으로 되돌리지 않는다. fixture의 오래된 전제를 수정하고, 실제 개발 스키마 차이는 검증한 별도 SQL로 처리한다. 템플릿 서버의 생성·중지·삭제와 복원 백업 관리는 호출자가 담당한다.
