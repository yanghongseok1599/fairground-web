import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  split?: boolean;
};

export function SectionHeading({ eyebrow, title, description, split = false }: SectionHeadingProps) {
  if (split) {
    return (
      <div className={styles.sectionHeadingSplit}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {description ? <p className={styles.lead}>{description}</p> : null}
      </div>
    );
  }

  return (
    <>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p className={styles.lead}>{description}</p> : null}
    </>
  );
}
