import type { CardType, Match, Tournament } from "@/types";
import { shootoutWinner } from "@/features/match-shootout/model";
import { fixtureOperatingNote } from "@/features/knockout-schedule/fixture-operating-notes";

export interface FinalPlacement { rank: number; teamId: string; teamName: string }

/** 운영가이드 경기 13~20: 챌린지/챔피언십 준결승, 7·8/5·6/3·4위전, 결승. */
export function finalPlacements(tournament: Tournament, matches: Match[]): FinalPlacement[] {
  if (tournament.groups.length !== 2 || tournament.groups.some(g => g.teamIds.length !== 4)) return [];
  const teamIds = new Set(tournament.groups.flatMap(g => g.teamIds));
  if (teamIds.size !== 8) return [];
  const games = matches.filter(m => m.tournamentId === tournament.id);
  const slot = (round: number) => {
    const rows = games.filter(m => m.round === round);
    return rows.length === 1 ? rows[0] : undefined;
  };
  const result = (round: number) => {
    const m = slot(round);
    if (!m || m.status !== "finished" ||
        m.homeTeamId === m.awayTeamId || !teamIds.has(m.homeTeamId) || !teamIds.has(m.awayTeamId)) return undefined;
    const winner = m.homeScore === m.awayScore ? shootoutWinner(m) : m.homeScore > m.awayScore ? "home" : "away";
    if (!winner) return undefined;
    const home = { teamId: m.homeTeamId, teamName: m.homeTeamName };
    const away = { teamId: m.awayTeamId, teamName: m.awayTeamName };
    return winner === "home" ? { winner: home, loser: away } : { winner: away, loser: home };
  };
  const challenge = [result(13), result(14)];
  const championship = [result(15), result(16)];
  if ([...challenge, ...championship].some(r => !r)) return [];
  const placements = [];
  const withdrawn: string[] = [];
  for (const [round, rank, semifinals, side] of [
    [17, 7, challenge, "loser"], [18, 5, challenge, "winner"],
    [19, 3, championship, "loser"], [20, 1, championship, "winner"],
  ] as const) {
    const expected = new Set(semifinals.map(s => s![side].teamId));
    if (expected.size !== 2) return [];
    const cancelled = round === 17 ? slot(round) : undefined;
    if (cancelled && !cancelled.groupId && fixtureOperatingNote(cancelled)) {
      // The official double withdrawal has no 7th/8th-place winner. Other finals remain valid.
      if (cancelled.homeTeamId === cancelled.awayTeamId ||
          !expected.has(cancelled.homeTeamId) || !expected.has(cancelled.awayTeamId)) return [];
      withdrawn.push(cancelled.homeTeamId, cancelled.awayTeamId);
      continue;
    }
    const r = result(round);
    if (!r || !expected.has(r.winner.teamId) || !expected.has(r.loser.teamId)) return [];
    placements.push({ ...r.winner, rank }, { ...r.loser, rank: rank + 1 });
  }
  const participants = [...placements.map(p => p.teamId), ...withdrawn];
  return participants.length === 8 && new Set(participants).size === 8 && participants.every(id => teamIds.has(id))
    ? placements.sort((a, b) => a.rank - b.rank) : [];
}

/** 대회 최종 순위 확정 후에만 사용하는 선수카드 등급. */
export function finalRankCardType(rank: number): CardType | undefined {
  if (!Number.isInteger(rank) || rank < 1 || rank > 8) return undefined;
  return rank === 1 ? "premium" : rank <= 5 ? "gold" : "silver";
}
