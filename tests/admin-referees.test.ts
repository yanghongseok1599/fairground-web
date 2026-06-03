import assert from "node:assert/strict";
import { getRefereeCandidates, getRefereeStatusLabel } from "../src/lib/admin-referees.ts";
import type { Player } from "../src/types/index.ts";

const basePlayer: Player = {
  id: "p1",
  uid: "p1",
  name: "선수",
  number: 7,
  position: "ALA",
  teamId: "",
  nationality: "KOR",
  photoUrl: "",
  cardType: "gold",
  cardRating: 90,
  stats: { goals: 0, assists: 0, games: 0, mom: 0 },
  badges: [],
  penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
  isApproved: false,
  role: "player",
  createdAt: 1,
};

const players: Player[] = [
  { ...basePlayer, id: "player", uid: "player", name: "일반 선수", role: "player" },
  { ...basePlayer, id: "pending-ref", uid: "pending-ref", name: "대기 심판", role: "referee", isApproved: false, createdAt: 3 },
  { ...basePlayer, id: "approved-ref", uid: "approved-ref", name: "승인 심판", role: "referee", isApproved: true, createdAt: 2 },
  { ...basePlayer, id: "admin", uid: "admin", name: "관리자", role: "admin", isApproved: true },
];

assert.deepEqual(getRefereeCandidates(players).map((player) => player.id), ["pending-ref", "approved-ref"]);
assert.equal(getRefereeStatusLabel(players[1]), "심판 승인 대기");
assert.equal(getRefereeStatusLabel(players[2]), "활동 심판");

console.log("admin-referees tests passed");
