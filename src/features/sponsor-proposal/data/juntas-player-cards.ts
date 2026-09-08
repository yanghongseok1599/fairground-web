import type { ProposalOfficialPlayerCard } from "@/features/sponsor-proposal/types";

const BASE_PLAYER = {
  teamId: "juntas-proposal",
  teamName: "FairGround",
  nationality: "KOR",
  penaltyStatus: {
    isBanned: false,
    banMatchesRemaining: 0,
    seasonYellowCards: 0,
  },
  isApproved: true,
  role: "player" as const,
  createdAt: 0,
};

export const JUNTAS_PROPOSAL_PLAYER_CARDS: ProposalOfficialPlayerCard[] = [
  {
    label: "PLATINUM · 공식 선수카드",
    teamLogo: "/images/team-logos/ref-bulls.webp",
    player: {
      ...BASE_PLAYER,
      id: "juntas-proposal-male",
      uid: "juntas-proposal-male",
      name: "김도현",
      number: 10,
      position: "PIVO",
      photoUrl: "/proposals/juntas/player-card-male-cutout-v2.png",
      gender: "male",
      photoScale: 0.96,
      cardType: "premium",
      cardRating: 104,
      stats: { goals: 14, assists: 7, games: 14, mom: 5 },
      badges: ["champion", "golden_boot", "mvp"],
    },
  },
  {
    label: "GOLD · 공식 선수카드",
    teamLogo: "/images/team-logos/ref-orion.webp",
    player: {
      ...BASE_PLAYER,
      id: "juntas-proposal-female",
      uid: "juntas-proposal-female",
      name: "이서연",
      number: 7,
      position: "ALA",
      photoUrl: "/proposals/juntas/player-card-female-cutout-v2.png",
      gender: "female",
      photoScale: 0.96,
      cardType: "gold",
      cardRating: 92,
      stats: { goals: 11, assists: 12, games: 14, mom: 4 },
      badges: ["assist_king", "playmaker", "fair_play"],
    },
  },
];
