export type JerseyNumber = number | "00";

export function jerseySortOrder(player: { number: JerseyNumber; jerseyNumberAssigned?: boolean }): number {
  return player.number === "00" || player.jerseyNumberAssigned || Number(player.number) > 0
    ? Number(player.number) : Number.MAX_SAFE_INTEGER;
}

/** Accept 0, 00 and 1–99; preserve double zero instead of parsing it away. */
export function parseJerseyNumber(value: string): JerseyNumber | null {
  if (!/^(00|0|[1-9]\d?)$/.test(value)) return null;
  return value === "00" ? "00" : Number(value);
}
export function jerseyNumberFromRow(row: { number: number; number_label?: string | null }): JerseyNumber {
  return row.number === 0 && row.number_label === "00" ? "00" : row.number;
}
export function jerseyNumberToRow(number: JerseyNumber) {
  if (parseJerseyNumber(String(number)) === null) throw new Error("등번호는 0, 00 또는 1~99로 입력해주세요.");
  return { number: Number(number), number_label: Number(number) === 0 ? String(number) : null };
}
