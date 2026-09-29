/** Preserve 1–3 typed digits, including leading zeros; legacy unset zero stays unset. */
export interface JerseyNumberValue {
  number?: number | null;
  numberLabel?: string | null;
}

export const JERSEY_NUMBER_PATTERN = "[0-9]{1,3}";
const validInput = new RegExp(`^${JERSEY_NUMBER_PATTERN}$`);

export function parseJerseyNumber(input: string): { number: number; numberLabel: string | null } | null {
  if (validInput.exec(input)?.[0] !== input) return null;
  return { number: Number(input), numberLabel: input };
}

export function storedJerseyNumberLabel(value: JerseyNumberValue): string | null {
  const label = value.numberLabel;
  return typeof label === "string" && validInput.exec(label)?.[0] === label && Number(label) === value.number
    ? label : null;
}

export function jerseyNumberText(value: JerseyNumberValue, fallback = "—"): string {
  const label = storedJerseyNumberLabel(value);
  if (label !== null) return label;
  return typeof value.number === "number" && Number.isInteger(value.number) && value.number > 0 && value.number <= 999
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
