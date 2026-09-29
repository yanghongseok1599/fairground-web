import { buildFixtureTimetable, timeFixtureSlots, type FixtureTiming } from "./fixture-timetable.ts";

// Four-team seed order from the Cup operating guide, before alternating groups.
const CUP_PAIRS = [[1, 2], [3, 4], [1, 3], [2, 4], [1, 4], [2, 3]] as const;

export function groupCourt(index: number, mode: FixtureTiming["courtMode"]): string {
  return mode === "single" ? "A구장" : `${String.fromCharCode(65 + index)}구장`;
}

export function buildGroupFixtureTimetable(teamCounts: number[], settings: FixtureTiming) {
  const groups = teamCounts.map((count, groupIndex) => {
    const fixtures = buildFixtureTimetable(count, settings);
    return fixtures.map((fixture, index) => ({
      ...fixture,
      ...(settings.courtMode === "single" && count === 4
        ? { home: CUP_PAIRS[index][0], away: CUP_PAIRS[index][1] } : {}),
      groupIndex, court: groupCourt(groupIndex, settings.courtMode),
    }));
  });
  if (settings.courtMode !== "single") return groups.flat();
  // A game from each group in turn; smaller groups simply finish sooner.
  const order = Array.from({ length: Math.max(0, ...groups.map((group) => group.length)) }, (_, index) =>
    groups.flatMap((group) => group[index] ? [group[index]] : []),
  ).flat();
  return timeFixtureSlots(order, settings);
}
