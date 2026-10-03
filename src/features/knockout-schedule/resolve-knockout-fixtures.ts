import type { Match, MatchStatus } from "@/types";
import { shootoutWinner } from "@/features/match-shootout/model";
import { knockoutSchedule } from "../../../public/cup-ops/knockout-fixtures.js";
import { KNOCKOUT_TOURNAMENT_ID, fixtureOperatingNote } from "./fixture-operating-notes";

export { KNOCKOUT_TOURNAMENT_ID } from "./fixture-operating-notes";

export type KnockoutMatch = Pick<Match,
  "id" | "tournamentId" | "groupId" | "round" | "homeTeamId" | "awayTeamId" |
  "homeTeamName" | "awayTeamName" | "homeScore" | "awayScore" |
  "homeShootoutScore" | "awayShootoutScore" | "status"
>;

export type ResolvedKnockoutFixture = {
  slot: number;
  time: string;
  reportTime: string;
  stage: string;
  home: string;
  away: string;
  match: string;
  homeRank?: string;
  awayRank?: string;
  homeLabel: string;
  awayLabel: string;
  homeTeamId?: string;
  awayTeamId?: string;
  matchId?: string;
  status?: MatchStatus;
  note?: string;
  homeScore?: number;
  awayScore?: number;
  homeShootoutScore?: number;
  awayShootoutScore?: number;
};

const normalizeName = (name: string) => name.replace(/\s+/g, "").toLocaleUpperCase();
// These are the completed league standings, not draw/seed order.
const originalRanks = new Map(Object.entries(knockoutSchedule.groups).flatMap(([group, teams]) =>
  teams.map((team, index) => [normalizeName(team.name), `${group} ${index + 1}위`] as const),
));
const NEXT_FIXTURES = {
  17: { sources: [13, 14], side: "loser" },
  18: { sources: [13, 14], side: "winner" },
  19: { sources: [15, 16], side: "loser" },
  20: { sources: [15, 16], side: "winner" },
} as const;

type TeamChoice = { id: string; name: string };

/** Actual registered fixtures win; unresolved/tied semifinal results stay placeholders. */
export function resolveKnockoutFixtures(matches: readonly KnockoutMatch[]): ResolvedKnockoutFixture[] {
  const games = matches.filter((match) => match.tournamentId === KNOCKOUT_TOURNAMENT_ID && !match.groupId);
  const slot = (round: number) => {
    const rows = games.filter((match) => match.round === round);
    return rows.length === 1 ? rows[0] : undefined;
  };
  const team = (match: KnockoutMatch, side: "home" | "away"): TeamChoice => side === "home"
    ? { id: match.homeTeamId, name: match.homeTeamName }
    : { id: match.awayTeamId, name: match.awayTeamName };
  const result = (round: number) => {
    const match = slot(round);
    if (!match || match.status !== "finished" || match.homeTeamId === match.awayTeamId ||
        !originalRanks.has(normalizeName(match.homeTeamName)) || !originalRanks.has(normalizeName(match.awayTeamName))) return;
    const winner = match.homeScore === match.awayScore ? shootoutWinner(match) : match.homeScore > match.awayScore ? "home" : "away";
    if (!winner) return;
    return winner === "home"
      ? { winner: team(match, "home"), loser: team(match, "away") }
      : { winner: team(match, "away"), loser: team(match, "home") };
  };

  return knockoutSchedule.fixtures.map((baseline) => {
    const actual = slot(baseline.slot);
    const dependency = NEXT_FIXTURES[baseline.slot as keyof typeof NEXT_FIXTURES];
    const homeResult = dependency ? result(dependency.sources[0])?.[dependency.side] : undefined;
    const awayResult = dependency ? result(dependency.sources[1])?.[dependency.side] : undefined;
    const home = actual ? team(actual, "home") : homeResult;
    const away = actual ? team(actual, "away") : awayResult;
    const homeName = home?.name ?? baseline.home;
    const awayName = away?.name ?? baseline.away;
    const homeRank = originalRanks.get(normalizeName(homeName));
    const awayRank = originalRanks.get(normalizeName(awayName));
    return {
      ...baseline,
      home: homeName,
      away: awayName,
      match: `${homeName} vs ${awayName}`,
      homeRank,
      awayRank,
      homeLabel: homeRank ? `${homeRank} · ${homeName}` : homeName,
      awayLabel: awayRank ? `${awayRank} · ${awayName}` : awayName,
      homeTeamId: home?.id,
      awayTeamId: away?.id,
      matchId: actual?.id,
      status: actual?.status,
      note: actual ? fixtureOperatingNote(actual) : undefined,
      homeScore: actual?.homeScore,
      awayScore: actual?.awayScore,
      homeShootoutScore: actual?.homeShootoutScore,
      awayShootoutScore: actual?.awayShootoutScore,
    };
  });
}
