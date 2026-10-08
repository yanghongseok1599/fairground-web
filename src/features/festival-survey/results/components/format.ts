const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatKstDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "날짜 정보 없음" : dateFormatter.format(date);
}

export function formatScore(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}
