import type { PracticeSnapshot } from "../store";
import { PRACTICE_STORAGE_KEY, readPracticeSnapshot } from "../persistence";
import type { RecordingCommand } from "./recording-commands";

export type RoomRole = "referee" | "admin" | "spectator";
export const roleLabel = (role: RoomRole) => role === "referee" ? "심판" : role === "admin" ? "관리자" : "참가자 중계";
export interface RoomMember { id: string; role: RoomRole; joinedAt: number }
export interface RoomFrame { room: string; owner: string; revision: number; snapshot: PracticeSnapshot }
export type RoomMessage =
  | { type: "state"; frame: RoomFrame }
  | { type: "request"; from: string }
  | { type: "offer"; from: string; to: string; frame: RoomFrame | null }
  | { type: "reset"; from: string; id: string; matchId: string }
  | { type: "recording"; from: string; id: string; matchId: string; command: RecordingCommand }
  | { type: "ack"; from: string; to: string; id: string; error?: string };

export const isRoomId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);
export const roomStorageKey = (room: string) => `fairground:shared-practice:v1:${room}`;

export function roomLink(origin: string, room: string, role?: RoomRole) {
  const url = new URL("/match-simulation", origin);
  url.searchParams.set("room", room);
  if (role) url.searchParams.set("role", role);
  return url.toString();
}

export function seat(members: RoomMember[], role: RoomRole) {
  return members.filter(m => m.role === role).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0]?.id ?? null;
}

export function validMember(value: unknown): value is RoomMember {
  if (!value || typeof value !== "object") return false;
  const m = value as RoomMember;
  return typeof m.id === "string" && m.id.length <= 80 && ["referee", "admin", "spectator"].includes(m.role) && Number.isFinite(m.joinedAt);
}

// Treat broadcasts and tab storage as untrusted. Rebuild virtual identities and
// never accept a production match, arbitrary roster, image URL or team ID.
export function readRoomFrame(value: unknown, room: string): RoomFrame | undefined {
  try {
    if (!value || typeof value !== "object") return;
    const f = value as RoomFrame;
    if (f.room !== room || typeof f.owner !== "string" || f.owner.length > 80 || !Number.isSafeInteger(f.revision) || f.revision < 0 ||
        !f.snapshot || typeof f.snapshot.running !== "boolean" || typeof f.snapshot.automatic !== "boolean" || f.snapshot.match.events.length > 1000) return;
    const snapshot = readPracticeSnapshot({ getItem: key => key === PRACTICE_STORAGE_KEY ? JSON.stringify({ version: 1, snapshot: f.snapshot }) : null });
    if (!snapshot) return;
    snapshot.running = snapshot.match.status === "live" && snapshot.elapsedSeconds < 720 && f.snapshot.running;
    snapshot.automatic = snapshot.match.status === "live" && snapshot.elapsedSeconds < 720 && f.snapshot.automatic;
    snapshot.match.events = snapshot.match.events.map(e => ({
      id: e.id.slice(0, 80), type: e.type, playerId: e.playerId,
      playerName: snapshot.players.find(p => p.id === e.playerId)!.name,
      teamId: e.teamId, minute: e.minute, half: e.half, timestamp: e.timestamp,
      isCancelled: e.isCancelled === true,
      ...((e as { automaticRed?: boolean }).automaticRed === true ? { automaticRed: true } : {}),
    }));
    return { room, owner: f.owner, revision: f.revision, snapshot };
  } catch { return; }
}
