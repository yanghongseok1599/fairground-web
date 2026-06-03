import type { Tournament } from "@/types";

export type TournamentDraftInput = {
  name: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  location: string;
  seasonId?: string;
};

export type TournamentDraft = Omit<Tournament, "id">;

export function formatTournamentSchedule(startDate: string, endDate?: string): string {
  const start = startDate.trim();
  const end = endDate?.trim() || "";
  if (!end || end === start) return start;
  return `${start} ~ ${end}`;
}

export function buildTournamentDraft(input: TournamentDraftInput, now = Date.now()): TournamentDraft {
  const date = input.date?.trim() || formatTournamentSchedule(input.startDate || "", input.endDate);

  return {
    seasonId: input.seasonId?.trim() || "",
    name: input.name.trim(),
    date,
    location: input.location.trim(),
    status: "upcoming",
    groups: [],
    matchIds: [],
    createdAt: now,
  };
}

export function isValidTournamentDraft(draft: Pick<TournamentDraft, "name" | "date" | "location">) {
  return draft.name.trim().length > 0 && draft.date.trim().length > 0 && draft.location.trim().length > 0;
}
