export type ShootoutAttempt = boolean | null;
export type ShootoutAttempts = { home: ShootoutAttempt[]; away: ShootoutAttempt[] };
export type SavedShootoutAttempts = { home: boolean[]; away: boolean[] };
export const MAX_SHOOTOUT_ATTEMPTS = 99;

/** Trailing placeholders are not kicks; gaps between recorded kicks are invalid. */
export function normalizeShootoutAttempts(attempts: ShootoutAttempts): SavedShootoutAttempts | null {
  const normalize = (values: ShootoutAttempt[]): boolean[] | null => {
    const recorded = [...values];
    while (recorded.at(-1) === null) recorded.pop();
    if (recorded.length > MAX_SHOOTOUT_ATTEMPTS || recorded.some(value => typeof value !== "boolean")) return null;
    return recorded as boolean[];
  };
  const home = normalize(attempts.home);
  const away = normalize(attempts.away);
  return home && away ? { home, away } : null;
}

export function shootoutAttemptTotals(attempts: ShootoutAttempts): [number, number] {
  return [attempts.home.filter(value => value === true).length, attempts.away.filter(value => value === true).length];
}

export function sameShootoutAttempts(a: ShootoutAttempts, b?: ShootoutAttempts): boolean {
  if (!b) return false;
  const first = normalizeShootoutAttempts(a);
  const second = normalizeShootoutAttempts(b);
  return !!first && !!second && JSON.stringify(first) === JSON.stringify(second);
}
