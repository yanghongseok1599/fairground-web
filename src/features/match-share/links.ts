/** A score revision gives newly shared corrections a fresh Kakao preview URL. */
export function getMatchShareLinks(origin: string, id: string, homeScore: number, awayScore: number, homeShootoutScore?: number, awayShootoutScore?: number) {
  const url = new URL(`/share/matches/${encodeURIComponent(id)}`, origin);
  const shootoutRevision = homeShootoutScore !== undefined && awayShootoutScore !== undefined ? `-pk-${homeShootoutScore}-${awayShootoutScore}` : "";
  url.searchParams.set("v", `${homeScore}-${awayScore}${shootoutRevision}`);
  const image = new URL(`${url.pathname}/image`, origin);
  image.search = url.search;
  return { url: url.href, imageUrl: image.href };
}
