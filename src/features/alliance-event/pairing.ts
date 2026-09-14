import type { Setup } from "./types.ts";

export type DrawIndex = (exclusiveMax: number) => number;

// Rejection sampling avoids modulo bias and works on plain-HTTP LAN browsers.
export const randomIndex: DrawIndex = (exclusiveMax) => {
  const range = 0x1_0000_0000;
  const limit = range - (range % exclusiveMax);
  const value = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % exclusiveMax;
};

export function drawSourcePairs(
  sources: Setup["sources"],
  choose: DrawIndex = randomIndex,
): [string, string][] {
  return (["A", "B"] as const).flatMap((group) => {
    const ids = sources
      .filter((source) => source.group === group)
      .map((source) => source.id);
    if (ids.length !== 6 || new Set(ids).size !== 6)
      throw new Error(`${group}조의 원 참가팀 6개를 확인해 주세요.`);
    // Fisher–Yates: each group is shuffled independently, then paired once.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = choose(i + 1);
      if (!Number.isInteger(j) || j < 0 || j > i)
        throw new Error("추첨값이 올바르지 않습니다.");
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return [0, 2, 4].map((i): [string, string] => [ids[i], ids[i + 1]]);
  });
}

export function randomizeSetup(
  setup: Setup,
  choose: DrawIndex = randomIndex,
): Setup {
  const pairs = drawSourcePairs(setup.sources, choose);
  const next = structuredClone(setup);
  next.teams = next.teams.map((team, i) => {
    const sameMembers = pairs[i].every((id) => team.sourceIds.includes(id));
    return {
      ...team,
      // Keep slot order when only the draw order reversed, preserving roster placeholders.
      sourceIds: sameMembers ? team.sourceIds : pairs[i],
      male: sameMembers ? team.male : "",
      female: sameMembers ? team.female : "",
      keepUpPlayers: sameMembers ? team.keepUpPlayers : Array(6).fill(""),
    };
  });
  return next;
}
