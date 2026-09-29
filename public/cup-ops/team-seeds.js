// 확정 조 추첨 시드. 대진의 A1~B4 코드는 이 목록에서 팀명으로 표시합니다.
export const teamSeeds = {
  A1: 'ROOT FC B팀',
  A2: 'FC LEGACY',
  A3: '데카트론 관심점',
  A4: 'FC 수박',
  B1: '데카트론 사랑점',
  B2: 'BOB FS',
  B3: 'ROOT FC A팀',
  B4: 'FC흰둥이',
};

export function resolveSeedNames(label) {
  return label.replace(/\b[AB][1-4]\b/g, (seed) => teamSeeds[seed]);
}
