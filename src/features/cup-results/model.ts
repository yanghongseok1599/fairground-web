import type { Match, Tournament } from "@/types";
import { finalPlacements } from "@/features/standings/final-placements";
import {
  CUP_RESULTS_TOURNAMENT_ID,
  PUBLISHED_GOALKEEPER_TEAM_NAME,
  PUBLISHED_MOM_RECIPIENTS,
} from "./data";
import type {
  CupAward,
  CupAwardWinner,
  CupMatchMom,
  CupResults,
  CupTeamResult,
  PublicCupPlayer,
} from "./types";

/** Finished cup records, rather than season profile counters, drive every total. */
export function buildCupResults(
  tournament: Tournament,
  matches: Match[],
  players: readonly PublicCupPlayer[] = [],
): CupResults | null {
  if (tournament.id !== CUP_RESULTS_TOURNAMENT_ID) return null;
  const games = matches.filter(match => match.tournamentId === tournament.id)
    .sort((a, b) => a.round - b.round);
  // A partial query, duplicate slot, or reopened match must never announce completion.
  if (games.length !== 20 || games.some((match, index) =>
    match.round !== index + 1 || !["finished", "cancelled"].includes(match.status),
  ) || games[19].status !== "finished") return null;
  const placements = finalPlacements(tournament, games);
  if (placements.length !== 6 && placements.length !== 8) return null;

  const teamNames = new Map<string, string>();
  for (const match of games) {
    teamNames.set(match.homeTeamId, match.homeTeamName);
    teamNames.set(match.awayTeamId, match.awayTeamName);
  }
  const teamByName = (name: string): CupTeamResult => {
    const teamId = [...teamNames].find(([, teamName]) => teamName === name)?.[0] ?? "";
    return { teamId, teamName: name };
  };
  const publicPlayers = new Map(players.map(player => [player.id, player]));
  const publicRecipient = (id: string) => PUBLISHED_MOM_RECIPIENTS.find(player => player.playerId === id);
  const playerIdentity = (id: string, match?: Match) => {
    const player = publicPlayers.get(id);
    const published = publicRecipient(id);
    const source = match ? [match] : games;
    const event = source.flatMap(game => game.events.filter(item =>
      item.playerId === id && !item.isCancelled &&
      [game.homeTeamId, game.awayTeamId].includes(item.teamId),
    )).at(-1);
    const publishedTeam = published ? teamByName(published.teamName) : undefined;
    const teamId = event?.teamId ?? player?.teamId ?? publishedTeam?.teamId;
    return {
      playerId: id,
      playerName: player?.name || event?.playerName || published?.playerName,
      teamId,
      teamName: teamId ? teamNames.get(teamId) ?? player?.teamName : published?.teamName,
    };
  };

  const matchMoms: CupMatchMom[] = games.map(match => {
    if (match.status === "cancelled") return { round: match.round, status: "cancelled" };
    if (!match.momPlayerId) return { round: match.round, status: "missing" };
    return { round: match.round, status: "selected", ...playerIdentity(match.momPlayerId, match) };
  });
  const missingMomRounds = matchMoms.filter(mom => mom.status === "missing").map(mom => mom.round);
  const isProvisional = missingMomRounds.length > 0;
  const momAwards: CupAward[] = PUBLISHED_MOM_RECIPIENTS.map(recipient => {
    const manual = recipient.selection === "operator-confirmed";
    const rounds = manual ? [] : matchMoms.filter(mom => mom.status === "selected" && mom.playerId === recipient.playerId)
      .map(mom => mom.round);
    return {
      id: recipient.awardId,
      title: recipient.title,
      status: !manual && (isProvisional || !rounds.length) ? "provisional" : "confirmed",
      winners: [{
        ...teamByName(recipient.teamName),
        playerId: recipient.playerId,
        playerName: (recipient.playerId ? publicPlayers.get(recipient.playerId)?.name : undefined) || recipient.playerName,
        count: rounds.length || undefined,
        rounds,
      }],
    };
  });

  const scorers = new Map<string, CupAwardWinner>();
  const seenGoalIds = new Set<string>();
  for (const match of games) {
    if (match.status !== "finished") continue;
    for (const event of match.events) {
      if (event.type !== "goal" || event.isCancelled || !event.playerId ||
          ![match.homeTeamId, match.awayTeamId].includes(event.teamId) || seenGoalIds.has(event.id)) continue;
      seenGoalIds.add(event.id);
      const scorer = scorers.get(event.playerId) ?? {
        playerId: event.playerId,
        playerName: publicPlayers.get(event.playerId)?.name || event.playerName,
        teamId: event.teamId,
        teamName: teamNames.get(event.teamId) ?? "",
        count: 0,
        rounds: [],
      };
      scorer.count = (scorer.count ?? 0) + 1;
      scorer.rounds.push(match.round);
      scorers.set(event.playerId, scorer);
    }
  }
  const topCount = Math.max(0, ...[...scorers.values()].map(scorer => scorer.count ?? 0));
  const topScorers = [...scorers.values()].filter(scorer => scorer.count === topCount)
    .sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? "", "ko") ||
      (a.playerId ?? "").localeCompare(b.playerId ?? ""));
  const awards: CupAward[] = [
    ...momAwards,
    { id: "top-scorer", title: "득점왕", winners: topScorers, status: "confirmed" },
    {
      id: "goalkeeper",
      title: "골레이로상",
      status: "name-pending",
      winners: [{ ...teamByName(PUBLISHED_GOALKEEPER_TEAM_NAME), rounds: [] }],
    },
  ];

  const rankedIds = new Set(placements.map(placement => placement.teamId));
  const withdrawnTeams = games.filter(match => match.status === "cancelled" && match.round === 17)
    .flatMap(match => [match.homeTeamId, match.awayTeamId])
    .filter(teamId => !rankedIds.has(teamId))
    .map(teamId => ({ teamId, teamName: teamNames.get(teamId) ?? "" }));
  return { placements, withdrawnTeams, awards, matchMoms, missingMomRounds, isProvisional };
}
