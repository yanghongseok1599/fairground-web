import { buildRotationFixture } from "./fixture-scheduler.ts";
import { MATCH_DURATION_MINUTES, MATCH_TRANSITION_MINUTES } from "./match-config.ts";

export interface FixtureTiming {
  courtMode?: "single" | "per-group";
  startTime: string;
  lunchStart: string;
  lunchMinutes: number;
}

export const DEFAULT_FIXTURE_TIMING: FixtureTiming = {
  courtMode: "single", startTime: "10:00", lunchStart: "", lunchMinutes: 0,
};

export function clockMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[1]) > 47 || Number(match[2]) > 59) {
    throw new Error("시각 형식이 올바르지 않습니다 (예: 10:00)");
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function clockLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** All schedule consumers share seed order, bye handling and lunch boundaries. */
export function buildFixtureTimetable(teamCount: number, settings: FixtureTiming) {
  if (!Number.isInteger(teamCount) || teamCount < 2) throw new Error("팀이 2팀 이상 필요합니다.");
  // The virtual final seed is a bye; it never creates a match or consumes a court slot.
  const fixtures = buildRotationFixture(teamCount + teamCount % 2)
    .filter((m) => m.home <= teamCount && m.away <= teamCount)
    .sort((a, b) => a.round - b.round || a.slot - b.slot);
  return timeFixtureSlots(fixtures, settings);
}

/** Assign times after court order is decided, so a shared court never overlaps. */
export function timeFixtureSlots<T>(fixtures: T[], settings: FixtureTiming) {
  let cursor = clockMinutes(settings.startTime);
  const lunch = settings.lunchStart.trim() ? clockMinutes(settings.lunchStart) : null;
  if (!Number.isInteger(settings.lunchMinutes) || settings.lunchMinutes < 0 || settings.lunchMinutes > 180) {
    throw new Error("점심 시간은 0~180분 사이의 정수로 입력해주세요.");
  }
  return fixtures.map((fixture, index) => {
    if (lunch !== null && settings.lunchMinutes > 0 && cursor + MATCH_DURATION_MINUTES > lunch && cursor < lunch + settings.lunchMinutes) {
      cursor = lunch + settings.lunchMinutes;
    }
    const startMinute = cursor;
    cursor += MATCH_DURATION_MINUTES + MATCH_TRANSITION_MINUTES;
    return { ...fixture, order: index + 1, startMinute, endMinute: startMinute + MATCH_DURATION_MINUTES };
  });
}

/** Tournament dates and clocks are Korean local time, independent of the operator's device. */
export function fixtureTimestamp(date: string, minute: number): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("대회 날짜를 확인해주세요.");
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  if (!Number.isFinite(midnight) || new Date(midnight + 9 * 60 * 60_000).toISOString().slice(0, 10) !== date) {
    throw new Error("대회 날짜를 확인해주세요.");
  }
  return midnight + minute * 60_000;
}
