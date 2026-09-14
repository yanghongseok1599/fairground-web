import { tieComplete } from "./scoring.ts";
import type { AllianceTeam, EventState, Game, Slot } from "./types.ts";

export const EVENT_STEPS = [
  "팀 준비",
  "슈팅왕",
  "공 살리기",
  "우승 발표",
] as const;
export type EventStep = 0 | 1 | 2 | 3;
export function currentEventStep(state: EventState): EventStep {
  if (!state.locked) return 0;
  if (!state.finalized.shooting) return 1;
  if (!state.finalized.keepUp) return 2;
  return 3;
}

export interface EventTurn {
  key: string;
  teamId: string;
  slot?: Slot;
  round: number;
  tieId?: string;
  pair: string[];
}

/** Rebuild the queue from saved attempts, so reloads and corrections never skip a turn. */
export function pendingTurns(state: EventState, game: Game): EventTurn[] {
  if (!state.locked || state.finalized[game]) return [];
  const tie = state.ties.find((t) => t.game === game && !tieComplete(state, t));
  const pairs = tie
    ? [tie.teamIds]
    : [0, 1, 2].map((i) => [
        state.setup.teams[i].id,
        state.setup.teams[i + 3].id,
      ]);
  const turns: EventTurn[] = [];
  for (const ids of pairs) {
    for (let round = 1; round <= (tie ? 1 : 2); round++) {
      for (const slot of game === "shooting"
        ? (["male", "female"] as const)
        : [undefined]) {
        for (const teamId of ids) {
          const count = state.attempts.filter(
            (a) =>
              !a.voided &&
              a.game === game &&
              a.teamId === teamId &&
              a.tieId === (tie?.id ?? null) &&
              a.slot === (slot ?? null),
          ).length;
          if (count < round)
            turns.push({
              key: `${game}:${tie?.id ?? "regular"}:${teamId}:${slot ?? "team"}:${round}`,
              teamId,
              slot,
              round,
              tieId: tie?.id,
              pair:
                ids.length === 2
                  ? ids
                  : [teamId, ids.find((id) => id !== teamId)!],
            });
        }
      }
    }
  }
  return turns;
}

export function rosterIssue(team: AllianceTeam): string | null {
  if (!team.male.trim()) return "슈팅왕 남자 대표 이름을 입력해 주세요.";
  if (!team.female.trim()) return "슈팅왕 여자 대표 이름을 입력해 주세요.";
  if (team.male.trim() === team.female.trim())
    return "남녀 대표를 각각 입력해 주세요. 동명이인은 등번호로 구분해 주세요.";
  if (team.keepUpPlayers.some((p) => !p.trim()))
    return "공 살리기 선수 6명의 이름을 입력해 주세요.";
  if (new Set(team.keepUpPlayers.map((p) => p.trim())).size !== 6)
    return "공 살리기 선수 이름이 중복됩니다. 동명이인은 등번호로 구분해 주세요.";
  return null;
}
