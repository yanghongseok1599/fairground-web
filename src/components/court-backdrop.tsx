// 풋살 코트 배경 — codex 로 생성한 고급 탑다운 구장 사진(잔디 줄무늬·흰 라인·
// 스타디움 조명·비네팅)을 경기 운영 대시보드 배경으로 깐다.
//  - landscape/데스크탑: pitch-landscape.png (가로 2:1, 골대 좌우)
//  - portrait(모바일 세로): pitch-portrait.png (세로 1:2, 골대 상하)
//
// object-cover 로 컨테이너를 꽉 채우며, 살짝 어두운 오버레이로 위에 올라가는
// 흰 선수 칩/텍스트 대비를 확보한다.

const BASE_GREEN = "#15331f";

/**
 * @param forceLandscape true 면 미디어쿼리와 무관하게 가로 코트 이미지(골대 좌우)를
 *   강제한다. 전체화면을 90° 회전해 가로로 보일 때(기기는 세로지만 화면은 가로)
 *   세로 이미지가 깔리는 문제를 막는다.
 */
export function CourtBackdrop({ forceLandscape }: { forceLandscape?: boolean } = {}) {
  if (forceLandscape) {
    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        style={{ background: BASE_GREEN }}
      >
        <img
          src="/match/pitch-landscape.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.12)" }} />
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
      style={{ background: BASE_GREEN }}
    >
      {/* 세로(모바일) */}
      <img
        src="/match/pitch-portrait.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover landscape:hidden md:hidden"
        draggable={false}
      />
      {/* 가로/데스크탑 */}
      <img
        src="/match/pitch-landscape.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 hidden h-full w-full object-cover landscape:block md:block"
        draggable={false}
      />
      {/* 가독성용 살짝 어두운 오버레이 */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.12)" }} />
    </div>
  );
}
