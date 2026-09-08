import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type ContactSectionProps = Pick<SponsorProposal, "contact" | "packages">;

export function ContactSection({
  contact,
  packages,
  title,
  eyebrow = "09 · 문의 및 확정",
  ctaTitle,
  ctaDescription,
}: ContactSectionProps & { title: string; eyebrow?: string; ctaTitle: string; ctaDescription: string }) {
  return (
    <section id="contact" className={`${styles.section} ${styles.contactSection}`}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
        />
        <div className={styles.contactGrid}>
          <div className={styles.contactCta} data-reveal>
            <h3>{ctaTitle}</h3>
            <p>{ctaDescription}</p>
            <div className={styles.packageChoices}>
              {packages.map((item) => (
                <span key={item.name}>{item.name.replace(" PARTNER", "")} · {item.price}</span>
              ))}
            </div>
          </div>
          <address className={styles.contactCard} data-reveal>
            <span>CONTACT</span>
            <strong>{contact.representative}</strong>
            <span>PHONE</span>
            <a href={contact.phoneHref}>{contact.phone}</a>
            <span>EMAIL</span>
            <a href={contact.emailHref}>{contact.email}</a>
            <span>WEB</span>
            <a href={contact.websiteHref} target="_blank" rel="noreferrer">{contact.website}</a>
            <div>{contact.proof}</div>
          </address>
        </div>
      </div>
    </section>
  );
}
