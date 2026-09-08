import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { BenefitsSection } from "@/features/sponsor-proposal/components/benefits-section";
import { ContactSection } from "@/features/sponsor-proposal/components/contact-section";
import { DeliverablesSection } from "@/features/sponsor-proposal/components/deliverables-section";
import { EventSection } from "@/features/sponsor-proposal/components/event-section";
import { ExposureSection } from "@/features/sponsor-proposal/components/exposure-section";
import { PackagesSection } from "@/features/sponsor-proposal/components/packages-section";
import { PlayerCardSection } from "@/features/sponsor-proposal/components/player-card-section";
import { ProposalHero } from "@/features/sponsor-proposal/components/proposal-hero";
import { ProposalNavigation } from "@/features/sponsor-proposal/components/proposal-navigation";
import { TimelineSection } from "@/features/sponsor-proposal/components/timeline-section";
import { TeamProgressionSection } from "@/features/sponsor-proposal/components/team-progression-section";
import { SponsorResponseSection } from "@/features/sponsor-proposal/components/sponsor-response-section";
import { ProductionShowcaseSection } from "@/features/sponsor-proposal/components/production-showcase-section";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type SponsorProposalPageProps = {
  proposal: SponsorProposal;
};

export function SponsorProposalPage({ proposal }: SponsorProposalPageProps) {
  return (
    <div className={styles.page} data-proposal-page="true">
      <ProposalNavigation
        fairgroundLogo={proposal.fairgroundLogo}
        sponsorLogo={proposal.sponsor.logo}
        sponsorLogoTreatment={proposal.sponsor.logoTreatment}
        responseLabel={proposal.sponsorResponse ? `${proposal.sponsor.name} 회신` : undefined}
        productionLabel={proposal.productionShowcase ? "제작 사례" : undefined}
        showTimeline={proposal.phases.length > 0}
      />
      <ProposalHero
        fairgroundLogo={proposal.fairgroundLogo}
        sponsor={proposal.sponsor}
        hero={proposal.hero}
        event={proposal.event}
      />
      {proposal.sponsorResponse ? (
        <SponsorResponseSection sponsorName={proposal.sponsor.name} response={proposal.sponsorResponse} />
      ) : null}
      <main>
        <BenefitsSection
          sponsorName={proposal.sponsor.name}
          benefits={proposal.benefits}
          benefitExamples={proposal.benefitExamples}
          title={proposal.copy.benefits.title}
          description={proposal.copy.benefits.description}
        />
        <EventSection event={proposal.event} />
        <PlayerCardSection playerCard={proposal.playerCard} />
        <TeamProgressionSection teamProgression={proposal.teamProgression} />
        <ExposureSection
          exposures={proposal.exposures}
          exposureSummary={proposal.exposureSummary}
          title={proposal.copy.exposure.title}
          description={proposal.copy.exposure.description}
        />
        {proposal.productionShowcase ? <ProductionShowcaseSection showcase={proposal.productionShowcase} /> : null}
        <DeliverablesSection
          deliverables={proposal.deliverables}
          deliverablesImage={proposal.deliverablesImage}
          deliverablesImages={proposal.deliverablesImages}
          deliverablesImageVariant={proposal.deliverablesImageVariant}
          title={proposal.copy.deliverablesTitle}
        />
        <PackagesSection
          packages={proposal.packages}
          comparison={proposal.comparison}
          packageNote={proposal.packageNote}
          title={proposal.copy.packagesTitle}
        />
        {proposal.phases.length > 0 ? (
          <TimelineSection phases={proposal.phases} title={proposal.copy.timelineTitle} />
        ) : null}
        <ContactSection
          contact={proposal.contact}
          packages={proposal.packages}
          title={proposal.copy.contact.title}
          eyebrow={proposal.phases.length > 0 ? "09 · 문의 및 확정" : "08 · 문의 및 확정"}
          ctaTitle={proposal.copy.contact.ctaTitle}
          ctaDescription={proposal.copy.contact.ctaDescription}
        />
      </main>
      <footer className={styles.proposalFooter}>
        FAIRGROUND × {proposal.sponsor.name} · OFFICIAL PARTNER PROPOSAL · 2026
        <br />
        Brand assets · FairGround Brand Kit 2026 / {proposal.sponsor.name} logo asset
        <br />
        Campaign images · fictional models and AI-directed visual references
        <br />
        Production cases · existing partner projects, shown for reference
      </footer>
    </div>
  );
}
