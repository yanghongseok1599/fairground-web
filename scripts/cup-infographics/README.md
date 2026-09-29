# FairGround Cup 일정 인포그래픽

확정된 **2026.10.03 / 8팀 / A구장 한 면 / 15분 간격** 일정을 공유용 3장으로 출력합니다.

- `export-data.mjs`: 운영가이드의 `public/cup-ops/data.js`, `team-seeds.js`를 읽습니다.
- `drawing.py`: 글꼴, 브랜드 색상, 공통 도형과 텍스트 너비 검증을 담당합니다.
- `pages.py`: 전체 시간표, 조별리그, 순위결정전 페이지를 각각 구성합니다.
- `build.py`: 20경기 시간 연속성, 팀별 조별리그 3경기, 대진 중복, 순위결정전 연결을 검증한 뒤 PDF를 생성합니다.

이 대회의 20경기 형식에 맞춘 템플릿입니다. 대회 형식이나 시작 시각을 바꾸면 `build.py`의 검증 조건과 `pages.py`의 요약 문구도 함께 수정해야 합니다.

## 생성

Node.js, Python `reportlab`, Poppler `pdftoppm`, Paperlogy TTF 글꼴(Regular, Medium, Bold, Black)이 필요합니다. 프로젝트 루트에서 실행합니다.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/cup-infographics/build.py --font-dir "$HOME/Library/Fonts"
mkdir -p output/infographics
pdftoppm -png -r 144 output/pdf/fairground-cup-2026-schedule.pdf output/infographics/fairground-cup-2026
```

출력:

- `output/pdf/fairground-cup-2026-schedule.pdf`: 글꼴을 포함한 3쪽 벡터 PDF, 540 × 900 pt
- `output/infographics/fairground-cup-2026-1.png`: 하루 전체 시간표
- `output/infographics/fairground-cup-2026-2.png`: 조편성 및 조별리그 12경기
- `output/infographics/fairground-cup-2026-3.png`: 순위결정전 8경기 연결도

PNG는 각 1080 × 1800 px입니다. 생성 후 세 장 모두 실제 이미지로 확인하고, PDF의 텍스트 추출 결과를 원본 일정과 대조합니다. 이 작업은 웹사이트 배포나 DB 변경을 수행하지 않습니다.
