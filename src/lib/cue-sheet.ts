import { buildFixtureTimetable, clockLabel, type FixtureTiming } from "./fixture-timetable.ts";
import { groupLabel } from "./match-schedule.ts";
import { compareScheduledMatches } from "./match-schedule.ts";
import { MATCH_DURATION_MINUTES } from "./match-config.ts";
import type { Match, TournamentGroup } from "@/types";

/**
 * 당일 큐시트 — 조별 대진에 실제 시각을 박는다.
 *
 * 조마다 전용 구장을 하나씩 배정하고(A조=A구장, B조=B구장) 동시에 진행한다.
 * 조별 풀리그라 조끼리 경기가 섞이지 않으므로, 각 구장은 자기 조의 라운드를
 * 순서대로 소화하면 된다.
 *
 * 슬롯 = 경기(12분) + 전환(8분) = 20분. 전환 시간은 팀 교대·급수·심판 리셋에
 * 쓰인다. match-config 의 값을 그대로 따르므로 규정이 바뀌면 큐시트도 따라간다.
 */

export type CueSheetSettings = FixtureTiming;

export interface CueRow {
  order: number;
  start: string;
  end: string;
  court: string;
  groupName: string;
  home: string;
  away: string;
}

export interface CueSheetResult {
  rows: CueRow[];
  /** 구장별 마지막 경기 종료 시각 */
  courtEnd: Record<string, string>;
  warnings: string[];
}

export interface CueGroupInput {
  name: string;
  /** 시드 순서대로의 팀 이름. buildRotationFixture 의 시드 번호와 1:1 대응한다. */
  teamNames: string[];
}

export function buildCueSheet(
  groups: CueGroupInput[],
  settings: CueSheetSettings,
): CueSheetResult {
  const rows: CueRow[] = [];
  const warnings: string[] = [];
  const courtEnd: Record<string, string> = {};
  groups.forEach((group, groupIndex) => {
    const court = `${String.fromCharCode(65 + groupIndex)}구장`;
    try {
      for (const match of buildFixtureTimetable(group.teamNames.length, settings)) {
        rows.push({
          order: match.order, start: clockLabel(match.startMinute), end: clockLabel(match.endMinute),
          court, groupName: group.name,
          home: group.teamNames[match.home - 1], away: group.teamNames[match.away - 1],
        });
        courtEnd[court] = clockLabel(match.endMinute);
      }
    } catch (error) {
      warnings.push(`${groupLabel(group.name)}: ${error instanceof Error ? error.message : "일정을 확인해주세요."}`);
    }
  });
  return { rows, courtEnd, warnings };
}

export function cueSheetToCsv(rows: CueRow[]): string {
  const header = ["순번", "시작", "종료", "구장", "조", "홈", "어웨이"];
  const body = rows.map((r) =>
    [r.order, r.start, r.end, r.court, groupLabel(r.groupName), r.home, r.away]
      .map((v) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

/** Once matches exist, the stored schedule is authoritative, including custom start/lunch times. */
export function buildSavedCueSheet(matches: Match[], groups: TournamentGroup[], date: string): CueSheetResult {
  const rows: CueRow[] = [];
  const warnings = new Set<string>();
  const courtEnd: Record<string, string> = {};
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  for (const match of [...matches].sort(compareScheduledMatches)) {
    const groupIndex = groups.findIndex((g) => g.id === match.groupId);
    const court = groupIndex >= 0 ? `${String.fromCharCode(65 + groupIndex)}구장` : "미지정";
    const minute = Math.round((match.scheduledAt - midnight) / 60_000);
    const validTime = Number.isFinite(minute) && minute >= 0 && minute < 48 * 60;
    if (!validTime) warnings.add("대회 날짜와 맞지 않는 경기 시간이 저장되어 있습니다. 확정 대진표와 대조해 수정이 필요합니다.");
    rows.push({
      order: match.round, court, groupName: groups[groupIndex]?.name ?? "미지정",
      start: validTime ? clockLabel(minute) : "시간 확인 필요",
      end: validTime ? clockLabel(minute + MATCH_DURATION_MINUTES) : "—",
      home: match.homeTeamName, away: match.awayTeamName,
    });
    if (validTime) courtEnd[court] = clockLabel(minute + MATCH_DURATION_MINUTES);
  }
  return { rows, courtEnd, warnings: [...warnings] };
}
