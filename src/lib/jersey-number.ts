/** Keep legacy unset zero distinct from a player's explicitly registered 0 or 00. */
export interface JerseyNumberValue {
  number?: number | null;
  numberLabel?: string | null;
}

export const JERSEY_NUMBER_PATTERN = "(?:00|0|[1-9][0-9]?)";
const validInput = new RegExp(`^${JERSEY_NUMBER_PATTERN}$`);

export function parseJerseyNumber(input: string): { number: number; numberLabel: string | null } | null {
  if (!validInput.test(input)) return null;
  return { number: Number(input), numberLabel: input === "0" || input === "00" ? input : null };
}

export function jerseyNumberText(value: JerseyNumberValue, fallback = "—"): string {
  if (value.number === 0 && (value.numberLabel === "0" || value.numberLabel === "00")) return value.numberLabel;
  return typeof value.number === "number" && Number.isInteger(value.number) && value.number > 0 && value.number <= 99
    ? String(value.number) : fallback;
}

export function hasJerseyNumber(value: JerseyNumberValue): boolean {
  return jerseyNumberText(value, "") !== "";
}

export function jerseyNumberOrder(value: JerseyNumberValue): number {
  return hasJerseyNumber(value) ? value.number! : Number.MAX_SAFE_INTEGER;
}

export function lineupJerseyNumberText(value: { jerseyNumber?: number; jerseyNumberLabel?: string | null }): string {
  // An explicit numeric zero in an old lineup was already a match-specific number.
  return jerseyNumberText({ number: value.jerseyNumber, numberLabel: value.jerseyNumberLabel ?? (value.jerseyNumber === 0 ? "0" : null) });
}
