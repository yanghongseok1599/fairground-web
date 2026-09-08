import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSponsorProposal, proposalSlugs } from "@/features/sponsor-proposal/data";
import { SponsorProposalPage } from "@/features/sponsor-proposal/sponsor-proposal-page";

type ProposalRouteProps = {
  params: Promise<{ sponsor: string }>;
};

export function generateStaticParams() {
  return proposalSlugs.map((sponsor) => ({ sponsor }));
}

export async function generateMetadata({ params }: ProposalRouteProps): Promise<Metadata> {
  const { sponsor } = await params;
  const proposal = getSponsorProposal(sponsor);

  if (!proposal) return {};

  return {
    title: `FairGround × ${proposal.sponsor.name} 공식 후원 제안`,
    description: `${proposal.event.title} ${proposal.sponsor.name} 공식 후원 혜택 및 패키지 제안`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ProposalPage({ params }: ProposalRouteProps) {
  const { sponsor } = await params;
  const proposal = getSponsorProposal(sponsor);

  if (!proposal) notFound();

  return <SponsorProposalPage proposal={proposal} />;
}
