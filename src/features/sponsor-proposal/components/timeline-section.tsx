import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type TimelineSectionProps = Pick<SponsorProposal, "phases">;

export function TimelineSection({ phases, title }: TimelineSectionProps & { title: string }) {
  return (
    <section id="timeline" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="08 · 진행 단계"
          title={title}
        />
        <div className={styles.timeline}>
          {phases.map((phase) => (
            <article key={phase.label} className={styles.phase} data-tone={phase.tone} data-reveal>
              <span>{phase.label}</span>
              <b>{phase.title}</b>
              <p>{phase.description}</p>
              <div>제공 · {phase.output}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
