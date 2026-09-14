export type Game = "shooting" | "keepUp";
export type AudienceTab = "live" | "records" | "scores";
export type Slot = "male" | "female";
export type Scene =
  | "standby"
  | "prepare"
  | "reveal"
  | "compare"
  | "shooting"
  | "keepUp"
  | "overall"
  | "winner";
export type Metric = "seconds" | "touches";

export interface AllianceTeam {
  id: string;
  group: "A" | "B";
  name: string;
  color: string;
  sourceIds: [string, string];
  male: string;
  female: string;
  keepUpPlayers: string[];
}

export interface Setup {
  title: string;
  metric: Metric;
  revealSeconds: number;
  sources: { id: string; group: "A" | "B"; name: string }[];
  teams: AllianceTeam[];
}

export interface Attempt {
  id: string;
  game: Game;
  teamId: string;
  slot: Slot | null;
  value: number;
  tieId: string | null;
  voided: boolean;
  createdAt: number;
}

export interface TieRound {
  id: string;
  game: Game;
  teamIds: string[];
}

export interface Standing {
  teamId: string;
  value: number | null;
  secondary: number | null;
  male: number | null;
  female: number | null;
  complete: boolean;
  rank: number | null;
  tied: boolean;
  points: number | null;
  keys: number[];
}

export interface OverallRow {
  teamId: string;
  shooting: number | null;
  keepUp: number | null;
  total: number | null;
  rank: number | null;
}

/** Immutable on-air snapshot: operator drafts and access tokens never enter it. */
export interface Output {
  title: string;
  demo: boolean;
  metric: Metric;
  scene: Scene;
  game: Game;
  teams: AllianceTeam[];
  sourceNames: Record<string, string>;
  pair: string[];
  focusTeamId: string;
  playerName: string;
  value: number | null;
  publishedAt: number;
  durationMs: number;
  held: boolean;
  shooting: Standing[];
  keepUp: Standing[];
  overall: OverallRow[];
  finalized: Record<Game, boolean>;
  winnerId: string | null;
}

export interface EventState {
  id: string;
  version: number;
  demo: boolean;
  setup: Setup;
  locked: boolean;
  attempts: Attempt[];
  ties: TieRound[];
  finalized: Record<Game, boolean>;
  output: Output;
  updatedAt: number;
}

export type Command =
  | { type: "audience"; tab: AudienceTab; game: Game }
  | { type: "setup"; setup: Setup }
  | { type: "lock" }
  | {
      type: "record";
      game: Game;
      teamId: string;
      slot?: Slot;
      value: number;
      tieId?: string;
      pair: string[];
    }
  | { type: "correct"; attemptId: string; value: number }
  | { type: "void"; attemptId: string }
  | { type: "replay"; attemptId: string }
  | {
      type: "show";
      scene: Scene;
      game: Game;
      pair: string[];
      teamId: string;
      slot?: Slot;
    }
  | { type: "hold" | "resume" }
  | { type: "finalize"; game: Game }
  | { type: "tiebreak"; game: Game; teamIds: string[] }
  | { type: "demo-records" };
