import { buildRotationFixture } from "./fixture-scheduler.ts";
import { MATCH_DURATION_MINUTES, MATCH_TRANSITION_MINUTES } from "./match-config.ts";

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

export interface CueSheetSettings {
  /** "HH:MM" — 첫 경기 시작 */
  startTime: string;
  /** "HH:MM" — 점심 시작. 빈 값이면 점심 없음 */
  lunchStart: string;
  /** 점심 길이(분) */
  lunchMinutes: number;
}

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

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 47 || min > 59) return null;
  return h * 60 + min;
};

const toLabel = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export interface CueGroupInput {
  name: string;
  /** 시드 순서대로의 팀 이름. buildRotationFixture 의 시드 번호와 1:1 대응한다. */
  teamNames: string[];
}

export function buildCueSheet(
  groups: CueGroupInput[],
  settings: CueSheetSettings,
): CueSheetResult {
  const warnings: string[] = [];
  const start = toMinutes(settings.startTime);
  if (start === null) {
    return { rows: [], courtEnd: {}, warnings: ["시작 시각 형식이 올바르지 않습니다 (예: 10:00)"] };
  }

  const lunchStart = settings.lunchStart.trim() ? toMinutes(settings.lunchStart) : null;
  if (settings.lunchStart.trim() && lunchStart === null) {
    warnings.push("점심 시각 형식이 올바르지 않아 점심을 건너뜁니다 (예: 13:00)");
  }
  const lunchLen = Math.max(0, Math.floor(settings.lunchMinutes || 0));
  const slot = MATCH_DURATION_MINUTES + MATCH_TRANSITION_MINUTES;

  const rows: CueRow[] = [];
  const courtEnd: Record<string, string> = {};

  groups.forEach((group, groupIndex) => {
    const court = `${String.fromCharCode(65 + groupIndex)}구장`;
    const count = group.teamNames.length;

    if (count < 2) {
      warnings.push(`${group.name}조: 팀이 ${count}팀이라 대진을 만들 수 없습니다`);
      return;
    }
    // buildRotationFixture 는 짝수만 받는다. 홀수면 부전승이 생기는데,
    // 큐시트에서 임의로 처리하면 실제 운영과 어긋나므로 알리고 건너뛴다.
    if (count % 2 !== 0) {
      warnings.push(`${group.name}조: ${count}팀(홀수)은 부전승 처리가 필요해 큐시트에서 제외했습니다`);
      return;
    }

    const fixture = buildRotationFixture(count);
    // 라운드 → 슬롯 순으로 정렬해야 실제 진행 순서가 된다.
    const ordered = [...fixture].sort((a, b) => a.round - b.round || a.slot - b.slot);

    let cursor = start;
    ordered.forEach((match, index) => {
      // 점심과 겹치면 경기를 점심 뒤로 민다.
      // 두 경우를 모두 잡아야 한다.
      //   (1) 점심 전에 시작하지만 점심 시각을 넘겨 끝나는 경기
      //   (2) 점심 시간 안에서 시작하는 경기 (정각 시작 포함)
      const lunchEnd = lunchStart === null ? null : lunchStart + lunchLen;
      if (
        lunchStart !== null &&
        lunchEnd !== null &&
        cursor + MATCH_DURATION_MINUTES > lunchStart &&
        cursor < lunchEnd
      ) {
        cursor = lunchEnd;
      }
      const end = cursor + MATCH_DURATION_MINUTES;
      rows.push({
        order: index + 1,
        start: toLabel(cursor),
        end: toLabel(end),
        court,
        groupName: group.name,
        home: group.teamNames[match.home - 1] ?? `시드 ${match.home}`,
        away: group.teamNames[match.away - 1] ?? `시드 ${match.away}`,
      });
      courtEnd[court] = toLabel(end);
      cursor += slot;
    });
  });

  return { rows, courtEnd, warnings };
}

export function cueSheetToCsv(rows: CueRow[]): string {
  const header = ["순번", "시작", "종료", "구장", "조", "홈", "어웨이"];
  const body = rows.map((r) =>
    [r.order, r.start, r.end, r.court, `${r.groupName}조`, r.home, r.away]
      .map((v) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}
