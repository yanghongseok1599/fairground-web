import { KNOCKOUT_TOURNAMENT_ID } from "@/features/knockout-schedule/fixture-operating-notes";

export const CUP_RESULTS_TOURNAMENT_ID = KNOCKOUT_TOURNAMENT_ID;

/**
 * Public award announcements verified with the event administrator on 2026-10-03.
 * This is the selected recipient list, not a copy of private profile gender data.
 * Counts and match numbers are always recalculated from this cup's finished matches.
 */
interface PublishedMomRecipient {
  awardId: "mens-mom" | "womens-mom";
  title: string;
  playerId?: string;
  playerName: string;
  teamName: string;
  selection: "record-tally" | "operator-confirmed";
}

export const PUBLISHED_MOM_RECIPIENTS: readonly PublishedMomRecipient[] = [
  {
    awardId: "mens-mom",
    title: "남자 최다 MOM",
    playerId: "e61ea3c5-4b91-4384-973b-13ab2ae5a369",
    playerName: "구준형",
    teamName: "BOB FS",
    selection: "record-tally",
  },
  {
    awardId: "womens-mom",
    title: "여자 MOM",
    playerId: "48453796-ffde-476b-88cc-8baa2aa556c1",
    playerName: "김주은",
    teamName: "데카트론 사랑점",
    selection: "operator-confirmed",
  },
];

/** The user selected the BOB FS goalkeeper; no individual name was confirmed. */
export const PUBLISHED_GOALKEEPER_TEAM_NAME = "BOB FS";
