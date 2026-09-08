import Image from "next/image";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type DeliverablesSectionProps = Pick<
  SponsorProposal,
  "deliverables" | "deliverablesImage" | "deliverablesImages" | "deliverablesImageVariant"
>;

export function DeliverablesSection({
  deliverables,
  deliverablesImage,
  deliverablesImages,
  deliverablesImageVariant,
  title,
}: DeliverablesSectionProps & { title: string }) {
  const visualImages = deliverablesImages?.length ? deliverablesImages : deliverablesImage ? [deliverablesImage] : [];
  const singleImageFrameClass = `${styles.deliverablesImageFrame} ${
    deliverablesImageVariant === "portrait" ? styles.deliverablesImagePortrait : ""
  }`;

  return (
    <section id="deliverables" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading eyebrow="06 · 제공 결과물" title={title} />
        <div className={`${styles.deliverables} ${visualImages.length === 0 ? styles.deliverablesTextOnly : ""}`}>
          {visualImages.length === 1 ? (
            <figure className={singleImageFrameClass} data-reveal>
              <Image src={visualImages[0].src} alt={visualImages[0].alt} fill sizes="(max-width: 900px) 100vw, 38vw" />
            </figure>
          ) : visualImages.length > 1 ? (
            <div className={styles.deliverablesImageGallery} data-reveal>
              {visualImages.map((image) => (
                <figure key={image.src} className={singleImageFrameClass}>
                  <Image src={image.src} alt={image.alt} fill sizes="(max-width: 900px) 50vw, 19vw" />
                </figure>
              ))}
            </div>
          ) : null}
          <div className={styles.deliverableList} data-reveal>
            {deliverables.map((deliverable, index) => (
              <div key={deliverable.title} className={styles.deliverableRow}>
                <span>
                  {visualImages.length === 0 || index !== deliverables.length - 1
                    ? String(index + 1).padStart(2, "0")
                    : "+"}
                </span>
                <div>
                  <b>{deliverable.title}</b>
                  <p>{deliverable.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
