# 개발 Preview 브라우저 회귀 테스트

이 테스트는 개발 Preview의 실제 Chromium 렌더링 화면에서 팀 카드 이동과 팀 정보 수정 취소를 검증한다. 합성 주장 계정으로 로그인하고 입력 내용을 바꾼 뒤 **저장하지 않고 취소**한다. 정상 종료 시 로그아웃하며, 두 PNG의 저장·디코딩 검증까지 성공해야 통과한다.

## 격리 Chromium 실행

사용자 브라우저의 확장·탭·프로필을 사용하지 않는 별도 테스트 브라우저다. `npm ci` 후 고정된 Playwright 버전의 Chromium headless shell을 설치한다. 다운로드 캐시는 시스템 임시 경로 또는 프로젝트 밖에 두고, 작업이 끝나면 자신이 만든 임시 경로만 정리한다. 브라우저 프로필은 Playwright가 시스템 임시 폴더에 만들고 종료 시 제거한다. 사용자 브라우저를 연결하는 CDP 주소나 기존 프로필 옵션은 받지 않는다.

```sh
npx playwright install chromium --only-shell
npm run test:browser -- \
  --engine chromium \
  --url https://fairground-DEPLOYMENT-milestones-projects-d52c4dda.vercel.app \
  --sha FULL_40_CHARACTER_COMMIT_SHA \
  --output /absolute/external/path/new-regression-run \
  --repeat 3
```

아래의 합성 계정 환경변수·정확한 READY Preview·빈 외부 증거 경로 조건은 두 엔진에 공통이다. Chromium 모드에서는 `--space`, `--page`, `--isolate-extension`을 거부한다. 확장 프로그램을 설치하거나 사용자 브라우저의 확장 상태를 변경하지 않는다. 서비스 워커는 요청 차단 우회를 방지하기 위해 차단하므로 PWA·오프라인 동작은 이 회귀 범위에 포함하지 않는다. 개발 외 Supabase 요청은 연결 전에 차단하고 실행을 실패 처리한다.

CDP 요청 단계에서 리다이렉트의 각 경유지를 검사한다. 실제 앱 통신은 해당 Preview와 개발 Supabase만 허용하며, 정적 글꼴·국기 및 고정 Pretendard 1.3.9 파일은 읽기만 허용한다. 선택적인 Vercel 피드백 도구의 정확한 스크립트 한 개는 가져오지 않고 `excludedToolingRequests`에 별도 기록한다. 운영 호스트·알 수 없는 외부 요청·새 팝업·네트워크 검사 오류는 전체 실패다. 앱의 본문 응답을 대체하거나 앱 입력을 흉내 내지 않는다. CORS preflight에 대한 라우팅의 영향은 아래에 별도로 명시한다.

페이지 이동 중 이미 사라진 요청의 interception ID에 명령을 보내면 Chromium이 정확히 `Invalid InterceptionId.`를 반환할 수 있다. 이미 허용한 목적지의 요청 단계에서 최초 `Fetch.continueRequest`가 이 오류를 반환한 경우만 `terminalMissingInterceptions`와 진단 항목에 기록하고 재요청 없이 마친다. 취소라고 추정하지 않으며, 다른 프로토콜 오류·시간 초과·중복 ID·응답 단계·금지 목적지는 계속 실패한다. 진단에는 고정 오류 종류와 이벤트 관측 여부만 남기며 임의 오류 원문·요청 ID·헤더는 저장하지 않는다.

Vercel Authentication이 적용된 Preview는 기존 자동화 인증 값을 `FAIRGROUND_BROWSER_PREVIEW_BYPASS` 환경변수로 전달한다. 표준 입력으로만 자식 실행기에 넘기고, 검증된 Preview origin에 자동 리다이렉트를 끈 인증 요청을 한 번 보낸다. 같은 호스트의 Secure·HttpOnly 쿠키만 생성됐는지 확인한 뒤 실제 브라우저 요청은 쿠키를 사용한다. 인증 값을 외부 Supabase·이미지 서버에 보내거나 Git·로그·증거 파일에 기록하지 않는다. 이 실행기는 보호 설정을 변경하거나 새 인증 값을 만들지 않는다.

페이지를 만들기 전에 컨텍스트 요청 가드를 설치한다. 정확한 테스트 페이지 `p1`이 소유한 요청만 진행하며, 초기 팝업처럼 아직 frame을 확인할 수 없거나 다른 페이지·서비스 워커가 소유한 요청은 첫 요청부터 중단한다. 같은 Preview로 향하는 추가 창도 허용하지 않는다. 요청 중단이 완료된 뒤 실패를 전달하고, 페이지 생성 이벤트에서 추가 창을 닫는 기존 검사도 유지한다. Playwright 라우팅은 리다이렉트 이후 요청을 다시 호출하지 않으므로 기존 `p1`의 CDP 경유지 검사는 별도로 유지한다.

컨텍스트 라우팅을 켜면 Playwright가 HTTP 캐시를 비활성화하고, 가로챈 CORS preflight에 자체 204 응답을 만들 수 있다. 이 회귀는 UI 동작·허용된 요청 대상·취소 보존을 검증하며 실제 서버의 CORS/preflight 또는 HTTP 캐시 동작을 검증하지 않는다.

## 기존 Ego TaskSpace 실행

- 기본 엔진은 `ego`다. 로컬 `ego-browser`와 인증된 `vercel` CLI가 필요하다.
- 호출자가 이 작업용 TaskSpace를 **한 번** 만들고 숫자 ID를 보관한다. 이미 이 작업의 TaskSpace가 있다면 같은 ID를 재사용한다.
- 환경변수 `FAIRGROUND_BROWSER_CAPTAIN_EMAIL`은 개발 합성 계정 `captain@example.com`, `FAIRGROUND_BROWSER_CAPTAIN_PASSWORD`는 그 계정의 비밀번호로 설정한다. 비밀번호는 명령 인자·Git·로그에 넣지 않는다. Ego의 실행 런타임은 CLI 환경변수를 상속하지 않으므로 실행기가 별도 `credentials` 객체를 표준 입력으로만 전달한다. 이 객체는 설정·명령 인자·증거 파일에 저장하지 않는다.
- READY 상태인 정확한 Preview 배포 URL과 전체 커밋 SHA를 사용한다. 운영·대표 도메인·브랜치 별칭 URL은 허용하지 않는다.
- 증거 디렉터리는 리포지터리 밖의 **비어 있는 절대 경로**여야 한다. 새 실행마다 다른 디렉터리를 사용한다.
- 확장 프로그램 간섭을 격리할 때만 `--isolate-extension aliprice`를 명시한다. 이는 알려진 확장 프로그램 한 개를 테스트 동안 일시 중지하는 옵션이며 **동일 브라우저의 다른 탭에도 일시적으로 영향을 준다.** 기본 실행은 확장 프로그램을 조회하거나 변경하지 않는다.

TaskSpace를 새로 만드는 경우:

```sh
ego-browser nodejs <<'JS'
const task = await taskSpace('FairGround browser regression');
console.log({ space: task.spaceId });
JS
```

반환된 숫자 ID, 실제 배포 URL 및 SHA를 넣어 실행한다:

```sh
npm run test:browser -- \
  --url https://fairground-DEPLOYMENT-milestones-projects-d52c4dda.vercel.app \
  --sha FULL_40_CHARACTER_COMMIT_SHA \
  --space NUMERIC_SPACE_ID \
  --page p1 \
  --output /absolute/external/path/new-regression-run \
  --repeat 3
```

`DEPLOYMENT`는 실제 배포의 9자리 소문자 영숫자 식별자로 바꾼다. `--repeat`는 기본 3, 허용 범위 1~10이다. `--sha`는 필수이며 소문자 40자리 Git SHA를 정확히 대조한다. 전체 브라우저 실행 제한은 180초다. `--page`는 기본 `p1`이며, 같은 TaskSpace에서 호출자가 확인한 기존 영구 Page 이름(`p2` 등)을 지정할 수 있다. 실행기는 앱 페이지를 생성하거나 실패한 앱 페이지를 자동 대체하지 않는다. 확장 격리를 명시했을 때만 같은 TaskSpace 안에 별도 관리 페이지를 한 개 만든다.

격리 Chromium은 180초 제한 뒤 최대 30초 동안 종료·증거 저장을 기다린다. 그래도 끝나지 않으면 해당 테스트 자식 프로세스만 강제 종료하고 실패로 기록한다. 강제 종료는 브라우저·프로필 정리 성공의 증거가 아니며 `runner-timeout.json`에서 `cleanupConfirmed:false`로 구분한다. 사용자 브라우저나 Ego 프로세스에는 강제 종료를 적용하지 않는다.

## 알려진 확장 프로그램의 일시 격리

위 명령에 `--isolate-extension aliprice`를 추가하면 알려진 AliPrice 계열 확장 ID `fahhlhbhnmkjegdfoiadmnhcclidoflh`만 대상으로 한다. 관리 페이지에서 정확한 ID·이름·종류·활성 상태를 확인한 후 원래 활성 상태를 `extension-receipt.json`에 기록한다. 해당 확장이 활성화돼 있으면 중지하고, 이미 중지돼 있으면 그대로 유지한다. 설치된 확장 전체 목록을 읽거나 다른 확장을 중지하지 않으며, 확장 삭제·권한 변경·브라우저 프로필 교체도 하지 않는다.

중지 시도 전에 상태를 기록하고 종료 시 `finally`에서 원래 상태로 복원한다. 브라우저 검증 성공과 확장 복원 성공을 모두 확인해야 세션 성공이다. 중지 또는 복원의 응답이 늦어진 경우, 이전 명령의 callback 완료를 확인하기 전에는 현재 활성 상태만 보고 복원 완료로 기록하거나 관리 페이지를 닫으면 안 된다. 미확정 상태는 실패로 남기고 같은 TaskSpace와 관리 페이지를 유지한다. 원래 중지 상태였던 확장은 복구 과정에서도 활성화하지 않는다.

180초 실행 제한으로 자식 실행이 중단되면 실행기는 저장된 영수증과 같은 TaskSpace의 관리 페이지를 이용해 **확장 원상복원만** 최대 30초 동안 별도로 시도한다. 앱 입력·로그인·테스트 전체를 재시도하지 않으며, 확장이 복구돼도 중단된 앱 검증은 실패로 남는다. 복원이 확인되지 않으면 `extension-receipt.json`의 단계와 기존 관리 페이지를 확인하고, 성공으로 보고하거나 공간을 종료하지 않는다.

## 검증 범위

- 자동으로 움직이는 팀 카드를 마우스로 눌렀을 때 예상 팀 상세로 이동한다.
- 화면 안의 카드를 선택하고 앱의 기존 포커스 동작으로 움직임을 멈춘 뒤 반복 클릭한다.
- 팀 이름 입력, 로고 선택·제거 후 취소해 편집 폼이 닫히는지 확인한다.
- 취소 후 원래 팀 이름과 로고가 유지되며, 새로고침해도 그대로인지 확인한다.
- 취소 이후 스크롤을 초기화하지 않고 다시 편집한다. 고정 헤더에 가려진 버튼은 실제 가림 상태를 관찰한 뒤 제한된 스크롤로 처리한다.
- 취소 구간의 요청에서 앱 데이터 쓰기가 없는지 검사한다. 비밀번호·요청 본문·인증 헤더는 증거에 저장하지 않는다.

실행기는 브라우저 접근 전에 Vercel **GET** 메타데이터로 고정 프로젝트 ID, Preview 대상, READY 상태, 변경 불가능한 URL, 기대 커밋을 대조한다. 누락되거나 맞지 않는 정보가 있으면 중단한다. 브라우저 테스트는 로그인 전에 실제 요청에서 개발 Supabase 호스트를 확인한다.

카드는 처음 복제본이 화면 밖으로 움직인 상태를 확인하고 실제 Tab 입력으로 포커스를 옮긴다. 카드의 의미·가시 영역·클릭 지점의 hit-test를 확인한 뒤 native 마우스 이동·누름·뗌을 사용한다. 강제 클릭, DOM `click()`, 합성 이벤트, 애니메이션 제거는 사용하지 않는다.

버튼은 입력 전 locator 확인 실패(`ElementResolutionError`) 뒤 **기존 FairGround 고정 헤더**의 실제 가림이 관찰된 경우만 복구한다. 버튼이 일부만 화면 위에 걸려 중심 좌표가 음수가 되면 `elementFromPoint` 결과가 없을 수 있으므로, 브랜드 링크가 있는 `header[data-site-header]`의 고정 위치와 상단 경계를 독립 확인한다. 버튼이 수평으로 완전히 보이고 위쪽 일부만 잘렸거나 실제 헤더가 입력을 가리는 경우에만 위로 한 번 스크롤한다. 이동량은 현재 `scrollY`와 viewport 높이 절반을 넘지 않는다.

스크롤 후 snapshot을 다시 얻고, 최대 5회(100ms 간격)의 관찰 중 연속 두 번 버튼 전체가 헤더 아래에서 입력을 받으며 위치·스크롤이 안정적인지 확인한 뒤 한 번만 다시 클릭한다. 알 수 없는 overlay, disabled/중복 버튼, 완전히 화면 밖에 있는 버튼, 계속 움직이는 레이아웃은 실패로 남긴다. 실제 입력 dispatch/CDP timeout은 늦은 효과가 있을 수 있으므로 클릭을 재시도하지 않는다.

기본 반복 3회는 카드 4개 사례(자동 이동 1회·포커스 일시정지 3회), 취소 3회(PNG 선택·제거 2회 포함), 새로고침 후 원본 보존 1회로 총 8개 사례다. 취소 후 draft는 앱의 기존 동작대로 유지하므로 재편집 입력이 초기화된다고 가정하지 않는다.

취소를 반복하는 동안 스크롤 상태를 유지한다. 모든 사례가 끝난 뒤에만 실제 휠 입력으로 상단의 원래 팀 이름·로고를 프레임에 넣고 PNG를 저장한다.

## 캡처 호환성과 증거

Ego 0.5.1.13의 PNG 캡처는 이 환경에서 빈 페이지에서도 `Page.captureScreenshot` 시간 초과가 발생했다. 기본 wrapper는 DPR 보정용 clip을 사용하며 실패 뒤 뷰포트가 반감되는 현상도 확인했다. `raw: true`, clip 없는 CDP, 창 활성화로도 정상 캡처를 확인하지 못했다. 제품 UI의 픽셀 검수 성공으로 보고하지 않는다.

현재는 별도 격리 Chromium에서 실제 화면 PNG를 필수로 검증한다. `capture.mjs`는 clip·CSS 배율 변환 없이 브라우저의 PNG를 받아 실제 디코딩, 1512×828 크기, 균일한 빈 이미지 여부, 캡처 전후 DPR·viewport 보존을 검사하고 파일 크기·SHA-256을 기록한다. pngjs의 동기 디코더가 손상된 zlib를 수용하는 경우도 확인해 표준 `inflateSync`로 압축 스트림의 종료·체크섬·scanline 크기를 독립 검증한다. 10초 안에 캡처가 완료되지 않거나 이미지·저장이 잘못되면 전체 실행이 실패한다. TXT 대체나 캡처 실패 무시는 없다. 이는 Ego 내부 캡처 버그 자체를 고쳤다는 의미가 아니다.

## 결과와 실패 처리

외부 증거 폴더에는 제한된 배포 정보 `deployment.json`, 사례별 결과와 PNG 해시를 담은 `results.json`, `team-card-detail.png`, `team-cancel-verified.png`, 전체 세션 상태 `session.json`이 저장된다. Chromium은 `chromium-cleanup.json`의 브라우저 종료까지 확인한다. Ego 확장 격리를 요청했다면 `extension-receipt.json`의 원상복원도 확인한다. 실패는 실패로 남기며 자동으로 전체 테스트를 재시도하지 않는다. Ego 타임아웃 후에는 **같은 TaskSpace와 증거를 먼저 확인**한다.

각 사례 전에 CPU 기록·디버거를 준비하고, 실패 시 가능한 CPU 프로파일·paused stack·최상단 스크립트 원문을 외부 증거 경로에 저장한다. `results.json`에는 실행 중 사례와 입력 단계도 남는다. 진행 중 입력이 실제로 종료되기 전에는 재시도하거나 다른 조작을 하지 않는다. 전체 실행 제한으로 종료되면 입력의 늦은 반영 가능성이 있으므로 같은 페이지를 직접 확인해야 한다. 이 진단 기능은 브라우저 자체 응답 중단의 원인을 확정하거나 자동 복구한다는 뜻이 아니다.

실행기는 TaskSpace를 생성하거나 종료하지 않는다. 확장 격리용 관리 페이지는 원상복원을 확인한 뒤 실행기가 닫는다. 호출자는 앱 검증 결과·로그아웃·확장 원상복원을 확인하고 모든 브라우저 작업을 마친 뒤 같은 공간을 한 번만 종료한다:

```sh
ego-browser nodejs <<'JS'
const task = await taskSpace(NUMERIC_SPACE_ID);
await task.finish({ keep: [] });
JS
```

사용자 제어나 오류 때문에 작업이 중단되었다면 임의로 공간을 종료하지 말고 해당 상태를 먼저 처리한다. 로그인이 남은 실패 실행은 같은 공간에서 합성 계정의 로그아웃 여부도 확인한다. 운영 DB·배포·환경변수 변경이나 전역 쿠키/스토리지 초기화는 이 테스트 범위에 없다.

## 모듈 구성

- `run.mjs`: CLI 진입점, Vercel 읽기 검증, 외부 증거 폴더, 엔진 선택·실행 제한과 Ego 중단 후 확장 복원 시도.
- `config.mjs`: URL·SHA·TaskSpace·반복 횟수·합성 계정·증거 경로·확장 격리 옵션 검증.
- `session.mjs`: 테스트와 `finally` 복원을 묶는 세션, 원자적 복원 영수증 저장, 전체 성공·실패 기록.
- `extensions.mjs`: 명시적으로 선택된 확장 한 개의 ID·원래 상태 확인, 일시 중지, 같은 관리 페이지에서 복원.
- `actions.mjs`: 화면에 관찰된 카드와 버튼을 안전하게 찾고 클릭하는 공통 동작.
- `suite.mjs`: 로그인, 팀 카드 이동, 취소 및 데이터 보존 검증.
- `capture.mjs`: 필수 PNG 캡처·디코딩·빈 이미지 검사·해시 증거.
- `chromium.mjs`, `chromium-entry.mjs`: 임시 Chromium 수명·요청 경계·기존 테스트 동작 어댑터·표준 입력 전달.
- `network.mjs`: 리다이렉트 경유지별 요청 허용·차단과 실패 증거.
- `context-request-guard.mjs`: 추가 창의 첫 요청부터 소유권 확인·차단, 중단 완료와 실패 전달.
- `check-context-guard-loopback.mjs`: 실제 Chromium에서 두 요청 가드의 동시 동작을 확인하는 별도 로컬 런타임 검사.
- `watchdog.mjs`: 실행 제한·종료 유예·격리 자식 프로세스 종료.

브라우저·DB 연결 없이 URL·설정 안전장치를 검사하려면 `npm run test:browser-config`를 실행한다. 동작·확장·세션 회귀까지 포함하려면 `node --test tests/browser-regression-*.test.mjs`를 실행한다.

실제 Chromium의 요청 순서는 별도 필수 검사 `node scripts/testing/browser/check-context-guard-loopback.mjs`로 확인한다. 설치된 Playwright Chromium과 `openssl`이 필요하며, 별도 브라우저 캐시를 사용한다면 이 명령에만 `PLAYWRIGHT_BROWSERS_PATH`를 지정한다. 이 검사는 임시 자체 서명 인증서·HTTPS 서버·CONNECT 프록시를 시스템 임시 폴더와 `127.0.0.1`에 만들고 종료 시 정리한다. 모든 요청 호스트는 프록시 안에서 루프백 서버로 연결되며 외부 DNS도 차단한다. 가상의 Preview 이름과 `blocked.invalid`를 사용해 정상 `p1` 요청, 추가 창 GET·POST, 같은 Preview의 추가 창 리다이렉트, `about:blank` 추가 창의 fetch, `p1`의 금지 리다이렉트를 검사한다. 실제 Preview·계정·DB에 접속하지 않는다.
