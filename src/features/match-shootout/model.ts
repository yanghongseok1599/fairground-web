import type { Match } from "@/types";

type ShootoutMatch = Pick<Match, "homeScore" | "awayScore" | "homeShootoutScore" | "awayShootoutScore" | "homeTeamName" | "awayTeamName">;

export function shootoutScoreError(home: number, away: number): string | undefined {
  if (![home, away].every(score => Number.isInteger(score) && score >= 0 && score <= 99)) {
    return "승부차기 성공 횟수는 0~99의 정수로 입력해주세요.";
  }
  if (home === away) return "승부차기 승자가 결정된 최종 점수를 입력해주세요.";
}

export function shootoutWinner(match: ShootoutMatch): "home" | "away" | undefined {
  const home = match.homeShootoutScore;
  const away = match.awayShootoutScore;
  if (match.homeScore !== match.awayScore || home === undefined || away === undefined || shootoutScoreError(home, away)) return;
  return home > away ? "home" : "away";
}

export function hasShootoutResult(match: ShootoutMatch): boolean {
  return shootoutWinner(match) !== undefined;
}

export function shootoutResultText(match: ShootoutMatch): string | undefined {
  const winner = shootoutWinner(match);
  if (!winner) return;
  return `승부차기 ${match.homeShootoutScore} : ${match.awayShootoutScore} · ${winner === "home" ? match.homeTeamName : match.awayTeamName} 승`;
}

export function requiresShootout(match: Pick<Match, "groupId" | "round" | "homeScore" | "awayScore">): boolean {
  return !match.groupId && match.round >= 13 && match.homeScore === match.awayScore;
}
