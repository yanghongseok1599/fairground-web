import type {
  EventState,
  Game,
  OverallRow,
  Standing,
  TieRound,
} from "./types.ts";

export const SHOOTING_POINTS = [100, 80, 60, 40, 20, 0] as const;
export const KEEP_UP_POINTS = [1000, 800, 600, 400, 200, 0] as const;
export const GAME_LABELS: Record<Game, string> = {
  shooting: "슈팅왕",
  keepUp: "공 살리기",
};

export function tieComplete(state: EventState, tie: TieRound) {
  return tie.teamIds.every((id) => {
    const records = state.attempts.filter(
      (a) => !a.voided && a.tieId === tie.id && a.teamId === id,
    );
    return tie.game === "keepUp"
      ? records.length === 1
      : records.some((a) => a.slot === "male") &&
          records.some((a) => a.slot === "female");
  });
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (b[i] ?? 0) - (a[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

export function gameStandings(state: EventState, game: Game): Standing[] {
  const relevantTies = state.ties.filter((t) => t.game === game);
  const rows = state.setup.teams.map((team): Standing => {
    const regular = state.attempts.filter(
      (a) => a.game === game && a.teamId === team.id && !a.voided && !a.tieId,
    );
    const male = regular.filter((a) => a.slot === "male").map((a) => a.value);
    const female = regular
      .filter((a) => a.slot === "female")
      .map((a) => a.value);
    const sorted = regular.map((a) => a.value).sort((a, b) => b - a);
    const complete =
      game === "shooting"
        ? male.length === 2 && female.length === 2
        : regular.length === 2;
    const maleBest = male.length ? Math.max(...male) : null;
    const femaleBest = female.length ? Math.max(...female) : null;
    const value =
      game === "shooting"
        ? maleBest !== null && femaleBest !== null
          ? (maleBest + femaleBest) / 2
          : null
        : (sorted[0] ?? null);
    // Integer hundredths avoid accidental floating-point ties. Shooting primary is the sum.
    const keys =
      game === "shooting"
        ? [
            Math.round(((maleBest ?? 0) + (femaleBest ?? 0)) * 100),
            ...sorted.map((v) => Math.round(v * 100)),
          ]
        : sorted.map((v) => Math.round(v * 100));
    for (const tie of relevantTies) {
      if (!tieComplete(state, tie)) continue;
      const values = state.attempts
        .filter((a) => !a.voided && a.tieId === tie.id && a.teamId === team.id)
        .map((a) => Math.round(a.value * 100))
        .sort((a, b) => b - a);
      if (game === "shooting")
        keys.push(
          values.reduce((sum, v) => sum + v, 0),
          values[0] ?? 0,
          values[1] ?? 0,
        );
      else keys.push(values[0] ?? 0);
    }
    return {
      teamId: team.id,
      value,
      secondary: sorted[1] ?? null,
      male: maleBest,
      female: femaleBest,
      complete,
      rank: null,
      tied: false,
      points: null,
      keys,
    };
  });
  const completed = rows
    .filter((row) => row.complete)
    .sort((a, b) => compareKeys(a.keys, b.keys));
  for (let i = 0; i < completed.length; i++) {
    const row = completed[i];
    row.tied = completed.some(
      (other) => other !== row && compareKeys(row.keys, other.keys) === 0,
    );
    row.rank = row.tied ? null : i + 1;
  }
  const ready =
    rows.every((r) => r.complete && !r.tied) &&
    relevantTies.every((t) => tieComplete(state, t));
  if (ready)
    for (const row of completed)
      row.points = (game === "shooting" ? SHOOTING_POINTS : KEEP_UP_POINTS)[
        row.rank! - 1
      ];
  return [...completed, ...rows.filter((r) => !r.complete)];
}

export function tiedGroups(state: EventState, game: Game): string[][] {
  const rows = gameStandings(state, game);
  if (!rows.every((r) => r.complete)) return [];
  const groups = new Map<string, string[]>();
  for (const row of rows.filter((r) => r.tied)) {
    const key = JSON.stringify(row.keys);
    groups.set(key, [...(groups.get(key) ?? []), row.teamId]);
  }
  return [...groups.values()];
}

export function overallStandings(state: EventState): OverallRow[] {
  const shooting = gameStandings(state, "shooting");
  const keepUp = gameStandings(state, "keepUp");
  const done = state.finalized.shooting && state.finalized.keepUp;
  return state.setup.teams
    .map((team) => {
      const s = state.finalized.shooting
        ? (shooting.find((r) => r.teamId === team.id)?.points ?? null)
        : null;
      const k = state.finalized.keepUp
        ? (keepUp.find((r) => r.teamId === team.id)?.points ?? null)
        : null;
      return {
        teamId: team.id,
        shooting: s,
        keepUp: k,
        total: s === null && k === null ? null : (s ?? 0) + (k ?? 0),
        rank: null,
      } as OverallRow;
    })
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
    .map((r, i) => ({ ...r, rank: done ? i + 1 : null }));
}

export function formatRecord(
  value: number | null,
  game: Game,
  metric: EventState["setup"]["metric"],
) {
  if (value === null) return "—";
  return game === "shooting"
    ? value.toFixed(Number.isInteger(value * 10) ? 1 : 2)
    : metric === "seconds"
      ? value.toFixed(2)
      : String(value);
}

export function recordUnit(game: Game, metric: EventState["setup"]["metric"]) {
  return game === "shooting" ? "km/h" : metric === "seconds" ? "초" : "회";
}
