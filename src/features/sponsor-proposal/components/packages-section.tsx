import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type PackagesSectionProps = Pick<SponsorProposal, "packages" | "comparison" | "packageNote">;

export function PackagesSection({
  packages,
  comparison,
  packageNote,
  title,
}: PackagesSectionProps & { title: string }) {
  const hasInKindPackage = packages.some((item) => item.name === "현물협찬");

  return (
    <section id="package" className={styles.section}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow="07 · 후원 패키지"
          title={title}
        />
        <div className={styles.packageGrid}>
          {packages.map((item) => (
            <article
              key={item.name}
              className={item.recommended ? styles.packageRecommended : styles.package}
              data-reveal
            >
              {item.recommended ? <span className={styles.recommendedFlag}>추천</span> : null}
              <span className={styles.packageName}>{item.name}</span>
              <div className={styles.price}>{item.price}</div>
              <p className={styles.packageSummary}>{item.summary}</p>
              <ul>
                {item.items.map((listItem) => (
                  <li key={listItem}>{listItem}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className={styles.tableScroll} data-reveal>
          <table>
            <thead>
              <tr>
                <th scope="col">제공 항목</th>
                {hasInKindPackage ? <th scope="col">현물협찬</th> : null}
                <th scope="col">OFFICIAL</th>
                <th scope="col">MAIN</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {hasInKindPackage ? <td>{row.inKind ?? "—"}</td> : null}
                  <td>{row.official}</td>
                  <td>{row.main}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.packageNote}>※ {packageNote}</p>
      </div>
    </section>
  );
}
