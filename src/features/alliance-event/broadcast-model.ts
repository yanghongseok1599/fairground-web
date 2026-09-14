import { effectiveScene } from "./engine.ts";
import type { AudienceTab, Game, Output, Standing } from "./types.ts";

export function audienceView(
  output: Output,
  now: number,
): {
  tab: AudienceTab;
  game: Game;
} {
  const scene = effectiveScene(output, now);
  return {
    tab:
      scene === "overall" || scene === "winner"
        ? "scores"
        : scene === "compare" || scene === "shooting" || scene === "keepUp"
          ? "records"
          : "live",
    game: scene === "shooting" || scene === "keepUp" ? scene : output.game,
  };
}

/** Live display ranks do not award points or change the official scoring state. */
export function audienceRecords(output: Output, game: Game) {
  const compare = (a: Standing, b: Standing) => {
    for (let i = 0; i < Math.max(a.keys.length, b.keys.length); i++) {
      const delta = (b.keys[i] ?? 0) - (a.keys[i] ?? 0);
      if (delta) return delta;
    }
    return 0;
  };
  const rows = [...output[game]].sort((a, b) => {
    if (a.value === null || b.value === null)
      return a.value === b.value ? 0 : a.value === null ? 1 : -1;
    return compare(a, b);
  });
  return rows.map((row, i) => ({
    ...row,
    displayRank:
      row.value === null
        ? null
        : output.finalized[game]
          ? row.rank
          : rows.findIndex(
              (other) => other.value !== null && compare(row, other) === 0,
            ) + 1,
    shared:
      row.value !== null &&
      rows.some(
        (other, j) =>
          j !== i && other.value !== null && compare(row, other) === 0,
      ),
  }));
}
