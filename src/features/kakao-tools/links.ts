export function getVenueSearchUrl(location: string): string | null {
  const query = location.trim();
  return query ? `https://map.kakao.com/link/search/${encodeURIComponent(query)}` : null;
}

export function getChannelChatUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "pf.kakao.com" || url.username || url.password) return null;
    const match = /^\/(_[A-Za-z0-9]+)(?:\/chat)?\/?$/.exec(url.pathname);
    return match ? `https://pf.kakao.com/${match[1]}/chat` : null;
  } catch {
    return null;
  }
}

export function getTournamentShareUrl(origin: string, tournamentId: string, matchId?: string): string {
  const url = new URL(`/tournaments/${encodeURIComponent(tournamentId)}`, origin);
  if (matchId) url.hash = `match-${matchId}`;
  return url.href;
}
