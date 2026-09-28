# 팀별 브론즈 카드 PNG

위치·폰트는 `src/lib/player-card-frame.ts`와 실제 `PlayerCard`/`PlayerCardCaptureFrame`을 그대로 사용한다. 등급 외형만 브론즈로 지정하며 원래 점수·기록·챌린지 자격은 변경하지 않는다. 모든 크기는 850px 카드 원본을 비율로 축소한다.

1. `node scripts/player-cards/prepare-team-export.mjs /절대/출력/폴더`로 운영 공개 선수·팀 정보를 읽는다. `.env.production` 공개 키만 사용하고 운영 대상이 다르면 중단한다. 이메일·전화번호는 읽지 않는다. 실패 시 기존 명단을 덮어쓰지 않는다.
2. 프로젝트의 `src/features/player-card-export/browser-entry.ts`를 브라우저용 IIFE로 번들한다. esbuild를 사용할 때 `--bundle --platform=browser --format=iife --global-name=FairgroundCardExport --jsx=automatic --define:process.env.NODE_ENV='"production"'`를 지정하고 별도 임시 폴더에 쓴다.
3. Ego Browser 작업 공간 한 곳에서 FairGround 페이지의 CSS·폰트를 로드한다. `FAIRGROUND_EXPORT_DIR`, `FAIRGROUND_EXPORT_BUNDLE`, `FAIRGROUND_EXPORT_SPACE`를 지정하고 `ego-browser nodejs < scripts/player-cards/render-team-export.ego.mjs`를 실행한다. 이미 만든 작업 공간을 재사용한다.
4. 2160×2700 RGBA PNG가 팀별 폴더에 저장된다. 동명이인·같은 팀명은 파일을 덮어쓰지 않는다. `export-results.json`에서 전체 건수, 실패, 등록 사진 없는 선수를 확인한다. 등록 사진이 없는 선수는 홈페이지와 같은 기본 포즈로 표시되며 실제 사진으로 꾸미지 않는다.
5. 실제 결과와 투명 배경을 확인한 뒤 팀별 폴더를 ZIP으로 묶고 브라우저 작업 공간을 종료한다. 임시 번들·테스트 이미지·브라우저 프로파일을 프로젝트에 남기지 않는다. 개인정보가 들어 있는 source.json과 최종 PNG는 Git에 커밋하지 않는다.

DB 연결 또는 개별 사진·로고 로드 실패를 성공으로 처리하지 않는다. 이 스크립트에는 DB/Auth/Storage 쓰기나 스키마 변경이 없다.
