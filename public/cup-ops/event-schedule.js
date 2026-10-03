// 2026.10.03 현장 확정 일정. 기본 편성과 분리해 당일 변경 범위를 좁힙니다.
export const EVENT_SCHEDULE_VERSION = '20261003-knockout-v1';

export const eventScheduleNotice = '2026.10.03 현장 변경 · 5경기 11:15 시작. 6·7경기와 10·11경기 순서를 교환했습니다. 1~4경기 시각은 당초 예정이며, 실제 진행·완료 시각은 현장 기록을 따릅니다. 5~12경기는 아래 확정 순서와 시각을 적용하고, 13경기 이후 순위전은 14:00부터 기존 일정대로 진행합니다.';

export const eventScheduleOverrides = [
  { slot: 5, time: '11:15–11:35', match: 'A1 vs A3' },
  { slot: 6, time: '11:35–11:55', match: 'A2 vs A4' },
  { slot: 7, time: '11:55–12:15', match: 'B1 vs B3' },
  { slot: 8, time: '12:15–12:35', match: 'B2 vs B4' },
  { slot: 9, time: '12:35–12:55', match: 'A1 vs A4' },
  { slot: 10, time: '12:55–13:15', match: 'A2 vs A3' },
  { slot: 11, time: '13:15–13:35', match: 'B1 vs B4' },
  { slot: 12, time: '13:35–13:55', match: 'B2 vs B3' },
];

const allSeeds = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
const overridesBySlot = new Map(eventScheduleOverrides.map(row => [row.slot, row]));

export function applyEventScheduleOverrides(matches) {
  return matches.map(row => {
    const override = overridesBySlot.get(row.slot);
    if (!override) return { ...row };
    const playingSeeds = override.match.split(' vs ');
    return {
      ...row,
      ...override,
      rest: allSeeds.filter(seed => !playingSeeds.includes(seed)).join(', '),
    };
  });
}
