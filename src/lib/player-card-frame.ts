/**
 * 선수카드의 고정 렌더링 규격.
 *
 * 모든 화면과 카드 등급은 이 프레임을 공유한다. 선수 데이터, 카드 배경과
 * 잉크 색상만 바뀌며 각 콘텐츠 슬롯의 좌표와 크기는 카드별로 재정의하지 않는다.
 */
export const PLAYER_CARD_FRAME_ID = "fairground-player-card-v1";

/**
 * 화면 표시, 미리보기, 저장 PNG가 함께 사용하는 완성형 카드 프리셋.
 * 새 카드 사용처는 개별 좌표를 만들지 않고 PlayerCard 컴포넌트와 이 ID를 공유한다.
 */
export const PLAYER_CARD_PRESET_ID = "fairground-player-card-complete-v1";

export type PlayerCardSize = "sm" | "md" | "lg" | "xl" | "export";

const PLAYER_CARD_POS = Object.freeze({
  rating: Object.freeze({ y: 17 }),
  position: Object.freeze({ y: 28 }),
  logo: Object.freeze({ y: 34.5 }),
  flag: Object.freeze({ y: 45.5 }),
  photo: Object.freeze({ x: 43.5, y: 11, w: 36, h: 42.5 }),
  name: Object.freeze({ y: 54.5, w: 48 }),
  badges: Object.freeze({ y: 63.5 }),
  stats: Object.freeze({ y: 75.5 }),
});

const PLAYER_CARD_FONT_PCT = Object.freeze({
  rating: 11,
  position: 4.5,
  flag: 9.3,
  name: 5.5,
  statVal: 5,
  statLabel: 3.2,
  badge: 4.5,
  logo: 11.2,
});

export const PLAYER_CARD_FRAME = Object.freeze({
  /** 카드 높이 / 너비 비율 */
  aspect: 1240 / 1080,
  /** 오버롤·포지션·로고·국기 열의 중심선 (%) */
  leftColCenter: 33,
  /** 세로형 카드 캔버스 기준 고정 슬롯 (%) */
  pos: PLAYER_CARD_POS,
  /** 카드 너비 대비 고정 콘텐츠 크기 (%) */
  fontPct: PLAYER_CARD_FONT_PCT,
});

export const PLAYER_CARD_WIDTH_PX: Readonly<Record<PlayerCardSize, number>> = Object.freeze({
  sm: 130,
  md: 200,
  lg: 280,
  xl: 560,
  export: 850,
});

export function getPlayerCardFrameDimensions(size: PlayerCardSize) {
  const width = PLAYER_CARD_WIDTH_PX[size];
  return {
    width,
    height: Math.round(width * PLAYER_CARD_FRAME.aspect),
  };
}
