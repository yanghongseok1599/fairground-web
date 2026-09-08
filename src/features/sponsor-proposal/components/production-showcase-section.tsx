import Image from "next/image";
import type { ProposalProductionShowcase } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type ProductionShowcaseSectionProps = {
  showcase: ProposalProductionShowcase;
};

export function ProductionShowcaseSection({ showcase }: ProductionShowcaseSectionProps) {
  return (
    <section id="proof" className={styles.productionSection}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow={showcase.eyebrow}
          title={showcase.title}
          description={showcase.description}
          split
        />

        <div className={styles.productionProof} data-reveal>
          <span>FAIRGROUND PRODUCTION PROOF</span>
          <b>현장에서 촬영하고, 바로 사용할 수 있는 콘텐츠로 편집합니다.</b>
          <p>{showcase.note}</p>
        </div>

        <div
          className={`${styles.productionImageGrid} ${
            showcase.layout === "square-grid" ? styles.productionImageGridSquare : ""
          }`}
        >
          {showcase.images.map((item) => (
            <figure
              key={item.title}
              className={`${styles.productionImageCard} ${item.variant === "wide" ? styles.productionImageWide : ""} ${
                item.variant === "portrait" ? styles.productionImagePortrait : ""
              }`}
              data-reveal
            >
              <div className={styles.productionImageFrame}>
                <Image
                  src={item.image.src}
                  alt={item.image.alt}
                  fill
                  quality={90}
                  sizes={
                    showcase.layout === "square-grid"
                      ? "(max-width: 620px) 100vw, (max-width: 900px) 50vw, 33vw"
                      : item.variant === "wide"
                        ? "(max-width: 900px) 100vw, 66vw"
                        : "(max-width: 900px) 50vw, 25vw"
                  }
                />
              </div>
              <figcaption>
                <span>{item.label}</span>
                <b>{item.title}</b>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className={styles.productionVideoGrid}>
          {showcase.videos.map((video, index) => (
            <figure
              key={video.title}
              className={`${styles.productionVideoCard} ${index === 0 ? styles.productionVideoFeature : ""}`}
              data-reveal
            >
              <div className={styles.productionVideoFrame}>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={video.poster.src}
                  aria-label={`${video.title} 영상`}
                >
                  <source src={video.src} type="video/mp4" />
                </video>
              </div>
              <figcaption>
                <span>{video.label}</span>
                <b>{video.title}</b>
                <p>{video.description}</p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className={styles.productionOutputs} data-reveal>
          <div className={styles.productionOutputLead}>
            <span>FOR JUNTAS</span>
            <b>준타스 협업 시 같은 제작 흐름으로 제공합니다.</b>
          </div>
          <div className={styles.productionOutputList}>
            {showcase.outputs.map((output, index) => (
              <article key={output.title} className={styles.productionOutput}>
                <span>{String(index + 1).padStart(2, "0")} · {output.label}</span>
                <b>{output.title}</b>
                <p>{output.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
