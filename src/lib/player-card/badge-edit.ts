export function filterEarnedBadgeIds(badges: string[], earned: Set<string> | null): string[] {
  return earned ? badges.filter((id) => earned.has(id)).slice(0, 4) : badges.slice(0, 4);
}

export function cardBadgePatch(badges: string[], earned: Set<string> | null, edited: boolean): { badges?: string[] } {
  if (!edited) return {}; // Unrelated edits must not resubmit stale equipment.
  if (!earned) throw new Error("배지 변경을 확인하려면 배지 다시 불러오기를 눌러주세요. 입력은 유지됩니다.");
  return { badges: filterEarnedBadgeIds(badges, earned) };
}
