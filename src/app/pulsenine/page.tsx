import type { Metadata } from "next";

import { pulsenineProposal } from "@/features/sponsor-proposal/data/pulsenine";
import { SponsorProposalPage } from "@/features/sponsor-proposal/sponsor-proposal-page";

export const metadata: Metadata = {
  title: "FairGround × PULSE NINE 공식 후원 제안",
  description:
    "2026년 10월 3일, 12팀이 하루 동안 참가합니다. PULSE NINE 공식 후원 혜택 및 패키지 제안",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PulseNineProposalPage() {
  return <SponsorProposalPage proposal={pulsenineProposal} />;
}
