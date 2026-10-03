export type MomPlayerOption = {
  value: string;
  label: string;
  teamId?: string;
};

function searchTerms(text: string): string[] {
  return text.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Search the displayed jersey, player and team together; keep exact player IDs. */
export function filterMomPlayerOptions(
  options: readonly MomPlayerOption[],
  query: string,
  teamId: string,
): MomPlayerOption[] {
  const terms = searchTerms(query);
  return options.filter((option) => {
    if (teamId && option.teamId !== teamId) return false;
    const label = option.label.normalize("NFKC").toLocaleLowerCase();
    return terms.every((term) => label.includes(term));
  });
}
