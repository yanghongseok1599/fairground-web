export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatMatchMinute(seconds: number, half: 1 | 2): string {
  const m = Math.floor(seconds / 60);
  return `${m}' ${half === 1 ? "전반" : "후반"}`;
}

export function calculateCardRating(stats: {
  goals: number;
  assists: number;
  mom: number;
}): number {
  const base = 90;
  const bonus = stats.mom * 3 + stats.goals + stats.assists;
  return Math.min(100, base + bonus);
}

export function positionLabel(pos: string): string {
  const map: Record<string, string> = {
    GK: "골키퍼",
    DF: "수비수",
    MF: "미드필더",
    FW: "공격수",
  };
  return map[pos] || pos;
}
