import type { Player } from "@/types";

type SubstitutionRoster = {
  onCourt: Player[];
  bench: Player[];
};

export type SubstitutionChoice = {
  counterpart: Player;
  outPlayer: Player;
  inPlayer: Player;
};

/** The first tap may be either side of a substitution; RPC arguments are always OUT, IN. */
export function getSubstitutionChoices(roster: SubstitutionRoster, selectedId: string) {
  const courtPlayer = roster.onCourt.find((player) => player.id === selectedId);
  const benchPlayer = roster.bench.find((player) => player.id === selectedId);
  const selectedPlayer = courtPlayer ?? benchPlayer;
  if (!selectedPlayer) return null;

  const fromBench = !courtPlayer;
  const counterparts = fromBench ? roster.onCourt : roster.bench;
  const choices: SubstitutionChoice[] = counterparts
    .filter((player) => player.id !== selectedId)
    .map((counterpart) => ({
      counterpart,
      outPlayer: fromBench ? counterpart : selectedPlayer,
      inPlayer: fromBench ? selectedPlayer : counterpart,
    }));
  return { fromBench, selectedPlayer, choices };
}
