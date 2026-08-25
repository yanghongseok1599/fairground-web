import type { Match } from "@/types";
import { MATCH_DURATION_MINUTES, MATCH_TRANSITION_MINUTES } from "./match-config.ts";

// 휴식-최적 대진 스케줄러.
// 써클(circle) 방식 단일 라운드로빈으로 대진을 생성하고, 슬롯 배치에 따른
// 팀별 휴식시간을 계산한다. 연속참가(streak) 높은 팀에게 휴식 총합이 가장 큰
// 시드를 배정하는 "휴식 시드 우선권"의 기반.
//
// 모델(파일 기준 · 스크린샷 검증): 단일 코트, 라운드당 슬롯 = N/2.
//   경기 12분 + 슬롯 사이 휴식(전환) 3분 → 한 슬롯 점유 = 15분.
//   글로벌 슬롯 g = (round-1)*slotsPerRound + (slot-1)
//   연속 경기 사이 휴식 = (g_next - g_prev)*(경기+휴식) - 경기
//   → 6팀: 피벗 132, 양끝 시드 147/117 (스크린샷 일치).

export interface FixtureMatch {
  round: number;
  slot: number; // 1-based, 라운드 내 경기 순서
  home: number; // 시드 번호 1..N
  away: number;
}

export interface SeedRest {
  seed: number;
  rests: number[]; // 라운드 사이 휴식(분) — 길이 N-2 (= 라운드수-1)
  totalRest: number;
}

// 파일 기준 기본값: 경기 12분, 슬롯 사이 휴식(전환) 3분.
const DEFAULT_MATCH_LEN_MIN = MATCH_DURATION_MINUTES;
const DEFAULT_BREAK_MIN = MATCH_TRANSITION_MINUTES;

/**
 * 써클 방식 라운드로빈. 최고 시드(N)를 매 라운드 1번 슬롯에 고정(피벗)한다.
 * N 은 짝수를 가정한다(홀수면 마지막 시드가 부전승 성격 — 호출부에서 처리).
 */
export function buildRotationFixture(seedCount: number): FixtureMatch[] {
  const n = seedCount;
  if (n < 2 || n % 2 !== 0) {
    throw new Error("buildRotationFixture: seedCount must be an even number >= 2");
  }
  const rounds = n - 1;
  const half = n / 2;
  // 회전 배열: 피벗(n)을 제외한 1..n-1.
  const rotating = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const matches: FixtureMatch[] = [];

  for (let r = 0; r < rounds; r++) {
    // r 라운드: rotating 을 오른쪽으로 r칸 회전한 뒤 피벗을 앞에 붙여 배치.
    const rotated = rotating.map((_, i) => rotating[(i - r + rotating.length) % rotating.length]);
    const list = [n, ...rotated]; // length n, list[0]=피벗
    // list[i] vs list[n-1-i] 페어링. i=0 페어가 피벗 → 1번 슬롯.
    for (let i = 0; i < half; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      matches.push({ round: r + 1, slot: i + 1, home: a, away: b });
    }
  }
  return matches;
}

/** 시드별 라운드간 휴식시간(분)과 총합. opts: 경기 길이(matchLenMin)·슬롯 휴식(breakMin). */
export function computeSeedRest(
  seedCount: number,
  opts?: { matchLenMin?: number; breakMin?: number },
): SeedRest[] {
  const matchLen = opts?.matchLenMin ?? DEFAULT_MATCH_LEN_MIN;
  const breakMin = opts?.breakMin ?? DEFAULT_BREAK_MIN;
  const slotInterval = matchLen + breakMin; // 한 슬롯 점유 시간
  const n = seedCount;
  const half = n / 2;
  const fixture = buildRotationFixture(n);
  const rounds = n - 1;

  // 시드별 각 라운드의 글로벌 슬롯 인덱스.
  const globalSlotBySeedRound = new Map<number, Map<number, number>>();
  for (const m of fixture) {
    const g = (m.round - 1) * half + (m.slot - 1);
    for (const seed of [m.home, m.away]) {
      if (!globalSlotBySeedRound.has(seed)) globalSlotBySeedRound.set(seed, new Map());
      globalSlotBySeedRound.get(seed)!.set(m.round, g);
    }
  }

  const result: SeedRest[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const byRound = globalSlotBySeedRound.get(seed)!;
    const rests: number[] = [];
    for (let r = 1; r < rounds; r++) {
      const gPrev = byRound.get(r)!;
      const gNext = byRound.get(r + 1)!;
      rests.push((gNext - gPrev) * slotInterval - matchLen);
    }
    result.push({ seed, rests, totalRest: rests.reduce((s, x) => s + x, 0) });
  }
  return result;
}

export interface SeedAssignment<T> {
  team: T;
  seed: number;
  rests: number[];
  totalRest: number;
}

/**
 * 연속참가(participationStreak) 높은 팀 → 휴식 총합 큰 시드 우선 배정.
 * streak 동률은 입력 순서 유지. 시드 수는 팀 수에 맞춰 짝수로 가정(홀수면 호출부에서 bye 처리).
 */
export function assignSeedsByStreak<T extends { participationStreak?: number }>(
  teams: T[],
  opts?: { matchLenMin?: number; breakMin?: number },
): Array<SeedAssignment<T>> {
  const n = teams.length;
  const rest = computeSeedRest(n, opts);
  // 휴식 총합 내림차순 시드(동률은 시드번호 오름차순).
  const seedsByRest = [...rest].sort(
    (a, b) => b.totalRest - a.totalRest || a.seed - b.seed,
  );
  // 팀: streak 내림차순(동률은 입력 순서 — index 보조키).
  const teamsByStreak = teams
    .map((team, idx) => ({ team, idx }))
    .sort(
      (a, b) =>
        (b.team.participationStreak ?? 0) - (a.team.participationStreak ?? 0) || a.idx - b.idx,
    );

  return teamsByStreak.map((entry, i) => {
    const seedRest = seedsByRest[i];
    return {
      team: entry.team,
      seed: seedRest.seed,
      rests: seedRest.rests,
      totalRest: seedRest.totalRest,
    };
  });
}

export interface RestTeam {
  id: string;
  name: string;
  participationStreak?: number;
}

/**
 * 휴식-최적 단일 풀리그 경기 생성. 연속참가 시드 배정 → 써클 대진 → 실제 Match.
 * 팀 수는 짝수여야 한다(홀수면 호출부에서 bye 팀을 추가).
 * 반환: 생성된 예정 경기 + 시드 배정(팀·시드·휴식 미리보기용).
 */
export function buildRestOptimizedMatches(
  teams: RestTeam[],
  tournamentId: string,
  opts?: { matchLenMin?: number; breakMin?: number; groupId?: string; startRound?: number },
): { matches: Array<Omit<Match, "id">>; assignments: Array<SeedAssignment<RestTeam>> } {
  if (teams.length < 2 || teams.length % 2 !== 0) {
    throw new Error("buildRestOptimizedMatches: 팀 수는 2 이상 짝수여야 합니다.");
  }
  const assignments = assignSeedsByStreak(teams, opts);
  const seedToTeam = new Map(assignments.map((a) => [a.seed, a.team]));
  const fixture = buildRotationFixture(teams.length);
  const groupId = opts?.groupId ?? "group-a";
  const startRound = opts?.startRound ?? 1;
  const now = Date.now();

  const matches = [...fixture]
    .sort((a, b) => a.round - b.round || a.slot - b.slot)
    .map((m) => {
      const home = seedToTeam.get(m.home)!;
      const away = seedToTeam.get(m.away)!;
      return {
        tournamentId,
        groupId,
        round: startRound + (m.round - 1),
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        homeScore: 0,
        awayScore: 0,
        status: "scheduled" as const,
        scheduledAt: now,
        events: [],
      };
    });

  return { matches, assignments };
}
