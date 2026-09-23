# 컵 대회 운영팀 가이드

공유 주소: https://fairground-kor.com/cup-ops

2026년 10월 3일 첫 번째 컵 대회의 운영 자료입니다. 기존 독립 가이드를 공식 도메인으로 옮겼으며, 별도 로그인 없이 링크로 확인합니다. 검색 결과에서는 제외합니다.

## 수정 위치

- `public/cup-ops/data.js`: 시간표, 대진, 담당자, 준비 일정, 승급 기준
- `public/cup-ops/app.js`: 안내 섹션, 목차, 링크 공유
- `public/cup-ops/index.html`: 행사 개요와 공유 메타데이터
- `public/cup-ops/styles.css`: 공통 화면과 모바일 배치
- `public/cup-ops/tiers.css`: 선수카드 프레임과 선수 이미지 위치
- `public/cup-ops/assets/`: 로고, 글꼴, 카드와 선수 이미지
- `next.config.ts`: `/cup-ops`를 정적 HTML로 연결
- `next-sitemap.config.js`: 검색 제외 경로

스타일·스크립트·이미지 주소는 `/cup-ops/` 기준입니다. 카드 이미지 경로를 수정할 때도 이 접두사를 유지합니다. CSS의 이미지·글꼴 상대 경로와 JavaScript의 모듈 import는 파일 위치를 기준으로 해석됩니다.

다른 서비스 화면과 스타일이 섞이지 않도록 가이드 파일은 이 폴더 안에서 관리합니다. 공유 버튼은 현재 공식 도메인의 주소와 선택한 섹션을 복사합니다. DB나 회원 데이터에 연결하지 않습니다.
