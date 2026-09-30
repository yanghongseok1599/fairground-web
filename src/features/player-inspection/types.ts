export interface InspectionPlayer {
  player_id: string;
  name: string;
  number: number;
  number_label: string | null;
  team_id: string;
  team_name: string;
  birth_date: string | null;
  is_approved: boolean;
  has_player_experience: boolean;
  checked_at: string | null;
  checked_by_name: string | null;
  revision: number;
}

export interface MyInspection {
  tournament_id: string;
  tournament_name: string;
  tournament_date: string | null;
  tournament_status: string;
  team_name: string;
  checked_at: string | null;
}

export interface InspectionTournament {
  id: string;
  name: string;
  date: string | null;
  status: string;
}

export type InspectionFilter = "all" | "pending" | "complete";
