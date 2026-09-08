export const MIXED_FUTSAL_ASSET_ROOT =
  "/images/tournaments/mixed-futsal-2026";

export const MIXED_FUTSAL_COVER_IMAGE_PATH =
  `${MIXED_FUTSAL_ASSET_ROOT}/01-cover.png`;

export const MIXED_FUTSAL_APPLICATION_IMAGE_PATH =
  `${MIXED_FUTSAL_ASSET_ROOT}/06-event-info.png`;

export const MIXED_FUTSAL_CARD_NEWS = [
  {
    src: MIXED_FUTSAL_COVER_IMAGE_PATH,
    label: "대회 포스터",
    title: "제1회 페어그라운드 혼성 풋살 대회",
    description: "2026년 10월 3일, 모두가 함께 뛰는 혼성 풋살 페스티벌",
  },
  {
    src: `${MIXED_FUTSAL_ASSET_ROOT}/02-everyone-wins.png`,
    label: "페스티벌 소개",
    title: "모두가 승리하는 즐거운 풋살 페스티벌",
    description: "승패를 넘어 함께 뛰고 응원하는 하루를 만듭니다.",
  },
  {
    src: `${MIXED_FUTSAL_ASSET_ROOT}/03-your-record.png`,
    label: "선수카드 시스템",
    title: "경기가 끝나도 기록과 경험은 남습니다",
    description: "득점, 어시스트, 출전과 MOM 기록이 선수카드에 반영됩니다.",
  },
  {
    src: `${MIXED_FUTSAL_ASSET_ROOT}/04-grow-together.png`,
    label: "팀 승급 시스템",
    title: "한 번의 참가가 팀의 새로운 역사가 됩니다",
    description: "대회 기록이 쌓일수록 팀 카드도 함께 성장합니다.",
  },
  {
    src: `${MIXED_FUTSAL_ASSET_ROOT}/05-ground-challenge.png`,
    label: "그라운드 챌린지",
    title: "슈팅킹과 프리킥킹에 도전하세요",
    description: "경기 밖의 도전 기록도 개인 랭킹과 전용 배지로 남습니다.",
  },
  {
    src: MIXED_FUTSAL_APPLICATION_IMAGE_PATH,
    label: "참가 신청",
    title: "우리 팀을 페어그라운드에 등록하세요",
    description: "얼리버드와 일반 참가비, 신청 경로를 한눈에 확인할 수 있습니다.",
  },
] as const;

export function isMixedFutsalPromotion(input: {
  name: string;
  title: string;
  ctaHref: string;
  secondaryHref: string;
}): boolean {
  const searchable = `${input.name} ${input.title}`.replaceAll(" ", "");
  return (
    searchable.includes("혼성풋살") ||
    input.ctaHref.startsWith("/mixed-futsal") ||
    input.secondaryHref.startsWith("/mixed-futsal")
  );
}
