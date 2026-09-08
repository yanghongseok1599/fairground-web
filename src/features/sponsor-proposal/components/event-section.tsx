import Image from "next/image";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type EventSectionProps = Pick<SponsorProposal, "event">;

export function EventSection({ event }: EventSectionProps) {
  return (
    <section id="event" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading eyebrow="02 · 대회 한눈에 보기" title={event.title} />
        <div className={styles.metrics}>
          {event.metrics.map((metric) => (
            <div key={metric.label} className={styles.metric} data-reveal>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.eventFeature} data-reveal>
          <figure className={styles.eventImageFrame}>
            <Image src={event.image.src} alt={event.image.alt} fill sizes="(max-width: 900px) 100vw, 66vw" />
          </figure>
          <div className={styles.facts}>
            <div className={styles.factsLabel}>EVENT FACTS</div>
            {event.facts.map((fact) => (
              <div key={fact.title} className={styles.fact}>
                <b>{fact.title}</b>
                <span>{fact.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
