import type { FinalPlacement } from "@/features/standings/final-placements";

/** Only the public identity fields needed by the result announcement. */
export interface PublicCupPlayer {
  id: string;
  name: string;
  teamId?: string;
  teamName?: string;
}

export interface CupTeamResult {
  teamId: string;
  teamName: string;
}

export interface CupAwardWinner extends CupTeamResult {
  playerId?: string;
  playerName?: string;
  count?: number;
  rounds: number[];
}

export interface CupAward {
  id: "mens-mom" | "womens-mom" | "top-scorer" | "goalkeeper";
  title: string;
  winners: CupAwardWinner[];
  status: "confirmed" | "provisional" | "name-pending";
}

export interface CupMatchMom {
  round: number;
  status: "selected" | "missing" | "cancelled";
  playerId?: string;
  playerName?: string;
  teamId?: string;
  teamName?: string;
}

export interface CupResults {
  placements: FinalPlacement[];
  withdrawnTeams: CupTeamResult[];
  awards: CupAward[];
  matchMoms: CupMatchMom[];
  missingMomRounds: number[];
  isProvisional: boolean;
}
