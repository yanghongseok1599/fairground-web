import Image from "next/image";
import { PlayerCard } from "@/components/player-card";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type ExposureSectionProps = Pick<SponsorProposal, "exposures" | "exposureSummary"> & {
  title: string;
  description: string;
};

export function ExposureSection({ exposures, exposureSummary, title, description }: ExposureSectionProps) {
  return (
    <section id="exposure" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="05 · 브랜드 노출"
          title={title}
          description={description}
          split
        />
        <div className={styles.exposureGrid}>
          {exposures.map((exposure) => (
            <figure key={exposure.label} className={styles.exposureCard} data-reveal>
              <div className={styles.exposureImageFrame}>
                {exposure.variant === "official-card" && exposure.officialCard ? (
                  <div className={styles.exposureOfficialCard}>
                    <div className={styles.exposureOfficialCardCanvas}>
                      <PlayerCard
                        player={exposure.officialCard.player}
                        teamLogo={exposure.officialCard.teamLogo}
                        size="lg"
                        disableHoverScale
                      />
                    </div>
                  </div>
                ) : exposure.variant === "social-reel" ? (
                  <div className={styles.socialReelVisual} role="img" aria-label={exposure.image.alt}>
                    <Image
                      src={exposure.image.src}
                      alt=""
                      fill
                      loading="eager"
                      sizes="(max-width: 900px) 100vw, 33vw"
                    />
                    <div className={styles.socialReelShade} />
                    <div className={styles.socialReelPhone}>
                      <div className={styles.socialReelHeader}>
                        <b>1-MIN FILM</b>
                        <span>REELS</span>
                      </div>
                      <div className={styles.socialReelPlay} aria-hidden="true">▶</div>
                      <div className={styles.socialReelFooter}>
                        <b>01:00</b>
                        <span>착용 · 경기 · 증정</span>
                      </div>
                    </div>
                    <span className={styles.socialVisualBadge}>1분 영상 · SNS 바이럴</span>
                  </div>
                ) : (
                  <Image
                    className={styles.exposureDirectImage}
                    src={exposure.image.src}
                    alt={exposure.image.alt}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                  />
                )}
              </div>
              <figcaption>
                <span>{exposure.label}</span>
                <b>{exposure.title}</b>
                <p>{exposure.description}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className={styles.exposureSummary}>
          <b>OFFICIAL:</b> {exposureSummary.official}
          <span aria-hidden="true">/</span>
          <b>MAIN:</b> {exposureSummary.main}
        </div>
      </div>
    </section>
  );
}
