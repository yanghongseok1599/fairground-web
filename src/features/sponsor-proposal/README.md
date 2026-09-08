# Sponsor proposal pages

후원사별 제안서를 같은 UI로 관리하는 기능입니다.

## 새 후원사 추가

1. `public/proposals/<slug>/`에 후원사 로고와 사진을 추가합니다.
2. `data/juntas.ts`를 복사해 `data/<slug>.ts`를 만들고 문구·금액·이미지 경로를 변경합니다.
3. `data/index.ts`의 `proposals` 객체에 새 데이터를 등록합니다.
4. `/proposal/<slug>`에서 화면을 확인합니다.

화면 구조와 스타일은 `components/`와 `sponsor-proposal.module.css`에서 공통 관리합니다. 업체별 차이는 데이터 파일에만 둡니다.
