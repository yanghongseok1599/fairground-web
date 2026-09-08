import Image from "next/image";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type TeamProgressionSectionProps = Pick<SponsorProposal, "teamProgression">;

export function TeamProgressionSection({ teamProgression }: TeamProgressionSectionProps) {
  return (
    <section id="promotion" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="04 · 팀 승급 시스템"
          title={teamProgression.title}
          description={teamProgression.description}
          split
        />
        <div className={styles.teamProgressionFeature}>
          <figure className={styles.teamProgressionImageFrame} data-reveal>
            <Image
              src={teamProgression.image.src}
              alt={teamProgression.image.alt}
              fill
              sizes="(max-width: 900px) 100vw, 58vw"
            />
          </figure>
          <div className={styles.teamProgressionPanel} data-reveal>
            <div className={styles.teamProgressionLabel}>TEAM PROGRESSION</div>
            <div className={styles.teamTierGrid}>
              {teamProgression.tiers.map((tier) => (
                <div key={tier.label} className={styles.teamTier}>
                  <span>{tier.label}</span>
                  <b>{tier.title}</b>
                  <p>{tier.detail}</p>
                </div>
              ))}
            </div>
            <p className={styles.teamProgressionValue}>{teamProgression.sponsorValue}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
