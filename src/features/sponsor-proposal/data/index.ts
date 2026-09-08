import { juntasProposal } from "@/features/sponsor-proposal/data/juntas";
import { partnerProposal } from "@/features/sponsor-proposal/data/partner";
import { pulsenineProposal } from "@/features/sponsor-proposal/data/pulsenine";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";

const proposals = {
  juntas: juntasProposal,
  partner: partnerProposal,
  pulsenine: pulsenineProposal,
} satisfies Record<string, SponsorProposal>;

export const proposalSlugs = Object.keys(proposals);

export function getSponsorProposal(slug: string): SponsorProposal | undefined {
  return proposals[slug as keyof typeof proposals];
}
