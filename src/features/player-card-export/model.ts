import { jerseyNumberText } from "../../lib/jersey-number.ts";
import type { Player } from "@/types";

export interface CardExportTeam { id: string; name: string; logo: string }
export interface CardExportJob {
  player: Player;
  teamName: string;
  teamLogo?: string;
  relativePath: string;
  hasRegisteredPhoto: boolean;
}

/** Unicode stays readable; encoding belongs only at an HTTP boundary. */
export function safeCardPathPart(value: string, fallback: string): string {
  const cleaned = value.normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return [...(cleaned || fallback)].slice(0, 80).join("");
}

export function buildCardExportJobs(players: Player[], teams: CardExportTeam[]): CardExportJob[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const usedFolders = new Set<string>();
  const folderById = new Map<string, string>();
  for (const team of [...teams].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = safeCardPathPart(team.name, "팀");
    let folder = base;
    let suffix = 2;
    while (usedFolders.has(folder.toLocaleLowerCase())) folder = `${base}_${suffix++}`;
    usedFolders.add(folder.toLocaleLowerCase());
    folderById.set(team.id, folder);
  }
  let unassigned = "미소속";
  while (usedFolders.has(unassigned.toLocaleLowerCase())) unassigned += "_";
  const usedFiles = new Set<string>();
  const seenPlayers = new Set<string>();
  return [...players].sort((a, b) => a.id.localeCompare(b.id)).map((player) => {
    if (!player.id || seenPlayers.has(player.id)) throw new Error("선수 ID가 비어 있거나 중복되었습니다.");
    seenPlayers.add(player.id);
    const team = teamById.get(player.teamId);
    if (player.teamId && !team) throw new Error(`선수 소속 팀을 찾을 수 없습니다: ${player.id}`);
    const folder = team ? folderById.get(team.id)! : unassigned;
    const stem = `${(player.number === 0 ? jerseyNumberText(player, "미지정") : String(player.number).padStart(2, "0"))}_${safeCardPathPart(player.name, "선수")}`;
    let path = `${folder}/${stem}.png`;
    let suffix = 2;
    while (usedFiles.has(path.toLocaleLowerCase())) path = `${folder}/${stem}_${suffix++}.png`;
    usedFiles.add(path.toLocaleLowerCase());
    return {
      player, teamName: team?.name ?? "미소속", teamLogo: team?.logo || undefined,
      relativePath: path, hasRegisteredPhoto: Boolean(player.photoUrl?.trim()),
    };
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ko"));
}
