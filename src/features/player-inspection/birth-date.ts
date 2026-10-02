/** Accept a keyboard-friendly eight-digit date or an ISO date, without Date rollover. */
export function normalizeInspectionBirthDate(value: string, today = new Date()): string {
  const input = value.trim();
  const iso = /^\d{8}$/.test(input)
    ? `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}` : input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error("생년월일을 19900101 또는 1990-01-01 형식으로 입력해주세요.");
  }
  const date = new Date(`${iso}T00:00:00Z`);
  const koreaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(today);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso
    || iso < "1900-01-01" || iso > koreaToday) {
    throw new Error("1900년부터 오늘까지의 실제 생년월일을 입력해주세요.");
  }
  return iso;
}
