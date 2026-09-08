import Image from "next/image";
import type { CSSProperties } from "react";
import { PlayerCard } from "@/components/player-card";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type PlayerCardSectionProps = Pick<SponsorProposal, "playerCard">;

export function PlayerCardSection({ playerCard }: PlayerCardSectionProps) {
  return (
    <section id="system" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="03 · 선수카드 제공 방식"
          title={playerCard.title}
          description={playerCard.description}
        />
        <div className={styles.playerCardGrid}>
          {playerCard.officialCards?.length ? (
            <div className={styles.officialPlayerCardPair} data-reveal>
              {playerCard.officialCards.map(({ player, teamLogo, label }) => (
                <figure key={player.id} className={styles.officialPlayerCardFigure}>
                  <div className={styles.officialPlayerCardSlot}>
                    <div className={styles.officialPlayerCardCanvas}>
                      <PlayerCard player={player} size="xl" teamLogo={teamLogo} disableHoverScale />
                    </div>
                  </div>
                  {label ? <figcaption>{label}</figcaption> : null}
                </figure>
              ))}
            </div>
          ) : (
            <div className={styles.playerCardPair} data-reveal>
              {playerCard.images.map((image) => (
                <figure key={image.src} className={styles.playerCard}>
                  <Image
                    src={image.src}
                    alt={image.alt}
                    width={720}
                    height={819}
                    sizes="(max-width: 620px) 45vw, 24vw"
                    style={{ "--player-card-scale-x": image.scaleX ?? 1 } as CSSProperties}
                  />
                </figure>
              ))}
            </div>
          )}
          <div className={styles.playerCardSteps}>
            {playerCard.steps.map((step, index) => (
              <div key={step.title} className={styles.stepLine} data-reveal>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{step.title}</b>
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
