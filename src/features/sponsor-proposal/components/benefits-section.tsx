import Image from "next/image";
import { PlayerCard } from "@/components/player-card";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type BenefitsSectionProps = Pick<SponsorProposal, "benefits" | "benefitExamples"> & {
  sponsorName: string;
  title: string;
  description: string;
};

export function BenefitsSection({ sponsorName, benefits, benefitExamples, title, description }: BenefitsSectionProps) {
  return (
    <section id="value" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="01 · 제안의 핵심"
          title={title}
          description={description}
        />
        <div className={styles.benefitGrid}>
          {benefits.map((benefit, index) => (
            <article key={benefit.title} className={styles.benefit} data-reveal>
              <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
              <b>{benefit.title}</b>
              <p>{benefit.description}</p>
            </article>
          ))}
        </div>
        <div className={styles.deliverablePreviewIntro} data-reveal>
          <div>
            <span>DELIVERABLE PREVIEW</span>
            <b>후원사가 받는 결과물을 실제 사용 형태로 보여드립니다.</b>
          </div>
          <p>촬영 사진 · 선수카드 · 1분 제품 홍보 영상</p>
        </div>
        <div className={styles.benefitGallery} data-reveal>
          {benefitExamples.map((example, index) => (
            <figure
              key={example.title}
              className={[
                index === 0 ? styles.galleryWide : "",
                example.variant === "social-video" ? styles.socialVideoFigure : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.benefitImageFrame}>
                {example.officialCard ? (
                  <div className={styles.benefitOfficialCard}>
                    <PlayerCard
                      player={example.officialCard.player}
                      size="lg"
                      teamLogo={example.officialCard.teamLogo}
                      disableHoverScale
                    />
                  </div>
                ) : (
                  example.video ? (
                    <video
                      className={styles.benefitVideo}
                      controls
                      playsInline
                      preload="metadata"
                      poster={example.image.src}
                      aria-label={`${example.title} 영상`}
                    >
                      <source src={example.video.src} type="video/mp4" />
                    </video>
                  ) : (
                    <Image src={example.image.src} alt={example.image.alt} fill sizes="(max-width: 620px) 100vw, 38vw" />
                  )
                )}
                {example.variant === "social-video" && !example.video ? (
                  <div className={styles.videoDeliverable} aria-hidden="true">
                    <div className={styles.videoDeliverableTop}>
                      <span>FAIRGROUND × {sponsorName}</span>
                      <b>01:00</b>
                    </div>
                    <span className={styles.videoPlay} />
                    <div className={styles.videoDeliverableCopy}>
                      <span>PRODUCT FILM</span>
                      <strong>{sponsorName} 제품 홍보 영상</strong>
                      <small>착용 장면 · 경기 현장 · 상품 증정</small>
                    </div>
                  </div>
                ) : null}
              </div>
              <figcaption>
                <b>{example.title}</b>
                <span>{example.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
