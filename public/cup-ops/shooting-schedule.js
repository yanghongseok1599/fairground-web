// 촬영팀 일정은 경기표의 슬롯 번호를 기준으로 관리합니다.
// 첫 네 경기에 8팀이 한 번씩 모두 등장하므로 이 구간이 팀별 촬영 최소 보장 구간입니다.
export const guaranteedTeamCoverage = [
  { slot: 1, media: '경기 사진', owner: '최민준', output: '두 팀별 선수 식별 컷, 경기 장면, 종료 후 표정' },
  { slot: 2, media: '세로 스케치 영상', owner: '영상 담당(미확정 시 지민 백업)', output: '두 팀 이름이 확인되는 경기 장면 10~15초' },
  { slot: 3, media: '경기 사진', owner: '최민준', output: '두 팀별 선수 식별 컷, 경기 장면, 종료 후 표정' },
  { slot: 4, media: '세로 스케치 영상', owner: '영상 담당(미확정 시 지민 백업)', output: '두 팀 이름이 확인되는 경기 장면 10~15초' },
];

// 팀별 최소 촬영을 마친 뒤 조별리그 중반은 협찬사 콘텐츠에 집중합니다.
// 한 슬롯에는 제품 한 종만 배정하고, 사진·영상 작가가 함께 촬영합니다.
export const sponsorShootWindows = [
  { slot: 5, sponsor: '아미노코치', focus: '얼음물 준비, 한 포씩 타서 흔들기, 시음·응원 장면' },
  { slot: 6, sponsor: '테이블코치', focus: '제품과 음식, 준비·시식·함께 나누는 장면' },
  { slot: 7, sponsor: '던윅', focus: '종아리 슬리브 착용, 사이즈 확인, 워밍업' },
  { slot: 8, sponsor: '캐터피', focus: '매직레이스 디테일, 신발 착용과 가벼운 움직임' },
  { slot: 9, sponsor: '니즈', focus: '아이싱패치 패키지, 사용 안내에 따른 준비와 개인 소감' },
  { slot: 10, sponsor: '썸머홀릭', focus: '제품 정면, 사용 안내에 따른 준비, 코트 이동' },
  { slot: 11, sponsor: '준타스', focus: '팀 유니폼·로고 디테일, 팀웨어를 입은 단체 장면' },
  { slot: 12, sponsor: '보완 촬영', focus: '누락 컷·제품 단독 컷 재촬영, 파일 확인과 백업' },
];

// 순위결정전은 한 경기씩 번갈아 맡고, 결승만 두 촬영자가 함께 담습니다.
export const knockoutCoverage = [
  { slot: 13, media: '경기 사진', owner: '최민준' },
  { slot: 14, media: '세로 스케치 영상', owner: '영상 담당(섭외 확정 필요)' },
  { slot: 15, media: '경기 사진', owner: '최민준' },
  { slot: 16, media: '세로 스케치 영상', owner: '영상 담당(섭외 확정 필요)' },
  { slot: 17, media: '경기 사진', owner: '최민준' },
  { slot: 18, media: '세로 스케치 영상', owner: '영상 담당(섭외 확정 필요)' },
  { slot: 19, media: '경기 사진', owner: '최민준' },
  { slot: 20, media: '사진 + 세로 영상', owner: '최민준 + 영상 담당' },
];
