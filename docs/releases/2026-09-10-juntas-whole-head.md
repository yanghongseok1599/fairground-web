# 준타스 제품·전체 머리 합성 — 2026-09-10

## 구현

- 얼굴 내부를 삼각형으로 변형하던 방식을 제거했다. 업로드한 사람의 머리카락·얼굴·귀와 머리 주변 액세서리를 분할하고 균일 확대/회전/이동으로 옮긴다. 모델의 원래 머리는 턱 위에서 완전히 지운다. 목 부분만 연결하며 턱 아래 긴 머리는 남긴다.
- 제품 대표이미지의 네이비퍼플 버터플라이 로얄넥(남성 기본), 화이트 펜서 로얄넥(여성 기본)을 참고해 유니폼 템플릿을 다시 생성했다. 두 템플릿의 모델은 머리띠가 없는 짧은 머리다.
- 생성 결과는 배경이 그려진 RGB PNG였다. 투명도 재편집 시도도 실제 알파를 제공하지 않아 사용하지 않았다. 원본을 보관하고 애플리케이션에서 신뢰도 마스크로 배경을 제거한 뒤 합성한다. 이 원본 이미지를 선수 사진으로 직접 표시하지 않는다.
- 이전 템플릿 URL과 기존 회원 사진을 덮어쓰지 않았다. 새 템플릿은 `juntas-male-02.png`, `juntas-female-02.png`이다.
- `내 유니폼프로필 등록하기`는 본인 사진의 배경만 제거하는 기존 경로를 유지한다.
- `cardSkin`은 챌린지 자격/집계 데이터로 보존하고 화면 문맥과 분리했다. 모든 기본/대회/편집/공개 카드는 등급별 카드이며 명시적인 `cardContext="challenge"`에서만 프리즘을 사용한다. 70점은 브론즈다.
- 선수 등록은 현재 URL의 챌린지 진입만 인정한다. 이전 영구 이벤트 표시를 제거하고, OAuth 인계용 표시는 세션당 30분 유효기간으로 제한한다. 일반 진입·손상·저장소 차단 시 일반 카드를 사용한다.
- Lazyweb의 [사진 선택·확인 화면](https://www.lazyweb.com/agentic-search/078f64ad-7b57-427e-84af-1f2ea55a69e5)을 참고해 전체 머리가 보이는 정면 사진과 저장 전 결과 확인 안내를 추가했다.

## 유지보수 경계

- `src/lib/player-card/head-geometry.ts`: 얼굴 비율을 보존하는 정렬과 클래스별 머리 마스크.
- `head-segmentation.ts`: 기기 내 분할 및 배경 제거. 사진을 외부 AI 서비스로 보내지 않는다.
- `vision-model.ts`: 동일 출처 모델 다운로드와 30초 중단. 구형 Safari를 고려해 AbortController 사용.
- `player-card-photo-composer.ts`: 템플릿 머리 제거·본인 머리 합성.
- `photo-registration.ts`: 두 등록 모드와 제품 템플릿 선택.
- `player-card-skin.ts`: 자격/표시 문맥/임시 이벤트 상태 분리.

## 모델

[MediaPipe Image Segmenter 공식 설명](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter)의 6개 클래스(background, hair, body skin, face skin, clothes, accessories)를 사용한다. [웹 API](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter/web_js)를 기준으로 CPU 실행과 결과 메모리 해제를 적용했다.

- 파일: `public/models/selfie-head/selfie_multiclass_256x256.tflite` (약 16MB, 최초 얼굴 등록 시 다운로드).
- 원본: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite
- SHA-256: `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0`.
- 코드 의존성 추가 없음. 기존 `@mediapipe/tasks-vision@0.10.32` 사용.

## 검증

- 메인과 운영 분리 소스: 린트 오류 0(기존 경고 19), TypeScript, 카드 테스트 4종, 전체 머리 기하/마스크 검사, 카드 문맥/이벤트 상태 테스트 4개, 사진 읽기 실패 회귀 11개 통과.
- 메인 보안 7개·Supabase 안전장치 4개 통과. 메인 빌드 통과. 운영 분리 소스는 환경변수 없이 첫 로컬 빌드가 차단됐고 운영 공개 환경변수를 주입한 재빌드가 통과했다.
- 브라우저 실제 실행: 남녀 새 유니폼 합성, 머리카락과 얼굴 동일성 시각 비교, 긴 머리/사선 얼굴 보존, 근접 얼굴, 얼굴 없음·다중 얼굴 거부, 본인 유니폼 보존. 카드 컴포넌트 DOM에서 같은 70점 챌린지 자격자에 대해 기본 문맥 브론즈/명시적 챌린지 홀로그램을 확인했다.
- 실제 iPhone Safari 및 실제 회원 계정 DB 저장은 검증하지 않았다. 모든 사진 조건에서 완벽한 분할/목 연결을 보장하지 않는다. 저장 전 미리보기 확인, 원본 정면 사진 재등록, 또는 본인 유니폼 모드가 대안이다.

## 배포 안전

운영 `dpl_Hf99Th72J52n3ub9WDzuX9ptMAho` 소스에 관련 수정만 적용했다. 기존 파일 856개 동일, 변경 12개, 누락 0개를 확인했고 모델·템플릿·공유 모듈·테스트를 추가했다. 팀/인증 스토어와 DB 객체는 이번에 변경하지 않는다.

운영 카탈로그 SELECT를 새로 실행하여 분리 배포 소스의 함수 35개·릴레이션 27개·버킷 1개 누락 0개를 확인했다. 메인 브랜치의 미배포 `register_team` 의존성과 마이그레이션 이력 불일치는 여전히 별도 문제이므로 메인 전체를 배포하지 않는다. Vercel DB 연결 환경변수 미설정에 대해서는 검증한 한 번의 배포 명령에만 대체 플래그를 사용하며 영구 설정이나 게이트를 변경하지 않는다.

이미 잘못 합성되어 저장된 사진은 원본 재등록이 필요하다. 원본이 없는 회원 사진을 추정해 일괄 변경하지 않는다.

## 사용한 생성 프롬프트

### male

참조: /Users/seok/PROJECT_FESTIVAL/futsal project/협찬사/준타스/페어그라운드_준타스_이미지 발송건/제퓸 대표이미지/저지-반팔-로얄넥-버터플라이-네이비퍼플.png

```text
Use case: product-mockup. Asset type: production transparent player-card portrait body template. Generate ONE photorealistic adult Korean amateur futsal athlete wearing the EXACT Juntas jersey in the supplied product-reference image. The reference is clothing guidance, not an edit target. Faithfully preserve jersey construction, collar, white/purple or gold/black panels as shown, crest position, chest typography and sleeve trim; do NOT substitute a generic JUNTAS T-shirt. Straight front-facing level shoulders, arms relaxed slightly away from torso, both hands visible, matching simple dark shorts. Crop at mid-thigh, generous transparent margin around entire head and hands, centered symmetrical 2:3 portrait. Natural soft diffuse frontal studio light and realistic fabric, no dramatic shadows. Neutral short tidy hair that stays entirely above jaw/neck; face straight forward, mouth closed. NO headband, no hat, no glasses, no necklace, no accessories, no football, no props, no scene. This template's head will be removed and replaced by each real user's entire head including their hairstyle, so keep hair away from jersey and shoulders and neck visible. Genuinely transparent background with alpha, not a checkerboard, no text outside the real jersey printing, no watermark. All body parts anatomically natural. Single person. Subject: adult male athlete with average athletic build, wearing exact NAVY/PURPLE BUTTERFLY ROYAL-NECK Juntas jersey from reference. Preserve large striped white JUNTAS chest logotype and purple details.
```

### female

참조: /Users/seok/PROJECT_FESTIVAL/futsal project/협찬사/준타스/페어그라운드_준타스_이미지 발송건/제퓸 대표이미지/준타스-저지반팔-로얄넥-펜서-화이트.png

```text
Use case: product-mockup. Asset type: production transparent player-card portrait body template. Generate ONE photorealistic adult Korean amateur futsal athlete wearing the EXACT Juntas jersey in the supplied product-reference image. The reference is clothing guidance, not an edit target. Faithfully preserve jersey construction, collar, white/purple or gold/black panels as shown, crest position, chest typography and sleeve trim; do NOT substitute a generic JUNTAS T-shirt. Straight front-facing level shoulders, arms relaxed slightly away from torso, both hands visible, matching simple dark shorts. Crop at mid-thigh, generous transparent margin around entire head and hands, centered symmetrical 2:3 portrait. Natural soft diffuse frontal studio light and realistic fabric, no dramatic shadows. Neutral short tidy hair that stays entirely above jaw/neck; face straight forward, mouth closed. NO headband, no hat, no glasses, no necklace, no accessories, no football, no props, no scene. This template's head will be removed and replaced by each real user's entire head including their hairstyle, so keep hair away from jersey and shoulders and neck visible. Genuinely transparent background with alpha, not a checkerboard, no text outside the real jersey printing, no watermark. All body parts anatomically natural. Single person. Subject: adult female athlete with average athletic build, wearing exact WHITE/GOLD FENCER ROYAL-NECK Juntas jersey from reference. Preserve gold TODO JUNTAS chest type, black shoulder panels and sleeve edging. Short tidy pixie hairstyle entirely above the collar, no ponytail over shoulders.
```
