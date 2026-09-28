import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// Read-only production export. No service-role key or development DB is used.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error("저장 폴더의 절대 경로를 지정하세요.");
const env = parseEnv(await readFile(path.join(repo, ".env.production"), "utf8"));
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (url.hostname !== "ovtnmslyjzvghirdvife.supabase.co" || url.protocol !== "https:") throw new Error("FairGround 운영 대상이 아닙니다.");
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!key) throw new Error("공개 조회 키가 없습니다.");
const columns = "id,name,number,position,team_id,nationality,photo_url,photo_scale,photo_offset_x,card_type,card_skin,card_rating,goals,assists,games,mom,badges,is_approved,role,created_at";
async function rows(table, select) {
  const result = [];
  for (let offset = 0; ; offset += 500) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.search = new URLSearchParams({ select, order: "id.asc", offset: String(offset), limit: "500" });
    const response = await fetch(endpoint, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${table} 조회 실패: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table} 응답 형식 오류`);
    result.push(...page);
    if (page.length < 500) return result;
  }
}
try {
  const [profiles, teams] = await Promise.all([rows("public_player_profiles", columns), rows("teams", "id,name,logo")]);
  if (!profiles.length) throw new Error("선수 명단이 비어 있습니다. 빈 파일로 덮어쓰지 않습니다.");
  const players = profiles.map(r => ({
    id: r.id, uid: r.id, name: r.name, number: r.number, position: r.position,
    teamId: r.team_id ?? "", nationality: r.nationality, photoUrl: r.photo_url ?? "",
    photoScale: r.photo_scale ?? undefined, photoOffsetX: r.photo_offset_x ?? undefined,
    cardType: r.card_type, cardSkin: r.card_skin, cardRating: r.card_rating,
    stats: { goals: r.goals, assists: r.assists, games: r.games, mom: r.mom }, badges: r.badges ?? [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: r.is_approved, role: r.role, createdAt: Date.parse(r.created_at),
  }));
  await mkdir(output, { recursive: true });
  const snapshot = path.join(output, "source.json");
  await writeFile(snapshot + ".tmp", JSON.stringify({ fetchedAt: new Date().toISOString(), players, teams }, null, 2), { mode: 0o600 });
  await rename(snapshot + ".tmp", snapshot);
  console.log(JSON.stringify({ players: players.length, teams: teams.length, missingPhotos: players.filter(p => !p.photoUrl).length }));
} catch (error) {
  console.error(error.name === "TimeoutError" ? "운영 DB 조회 시간 초과. 선수 명단이나 PNG를 생성한 것으로 처리하지 않았습니다." : error.message);
  process.exitCode = 1;
}
