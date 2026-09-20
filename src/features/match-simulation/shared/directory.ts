import { isRoomId, validMember, type RoomMember } from "./protocol";

export type RoomAdvertisement = RoomMember & { room: string };
export interface ListedRoom {
  room: string;
  refereeCount: number;
  adminCount: number;
  spectatorCount: number;
  firstJoinedAt: number;
}

/** Presence is untrusted and may contain multiple connections for one participant. */
export function listActiveRooms(entries: unknown[]): ListedRoom[] {
  const rooms = new Map<string, { listing: ListedRoom; members: Set<string> }>();
  for (const entry of entries) {
    if (!validMember(entry) || !entry.id || !isRoomId((entry as RoomAdvertisement).room) || entry.joinedAt < 0) continue;
    const member = entry as RoomAdvertisement;
    let group = rooms.get(member.room);
    if (!group) {
      group = { listing: { room: member.room, refereeCount: 0, adminCount: 0, spectatorCount: 0, firstJoinedAt: member.joinedAt }, members: new Set() };
      rooms.set(member.room, group);
    }
    if (group.members.has(member.id)) continue;
    group.members.add(member.id);
    group.listing.firstJoinedAt = Math.min(group.listing.firstJoinedAt, member.joinedAt);
    if (member.role === "referee") group.listing.refereeCount += 1;
    else if (member.role === "admin") group.listing.adminCount += 1;
    else group.listing.spectatorCount += 1;
  }
  return [...rooms.values()].map(({ listing }) => listing)
    .sort((a, b) => b.firstJoinedAt - a.firstJoinedAt || a.room.localeCompare(b.room));
}
