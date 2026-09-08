import Image from "next/image";
import Link from "next/link";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type ProposalHeroProps = Pick<SponsorProposal, "fairgroundLogo" | "sponsor" | "hero" | "event">;

export function ProposalHero({ fairgroundLogo, sponsor, hero, event }: ProposalHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroCopy}>
          <div className={styles.heroLogos}>
            <Link href="/" aria-label="FairGround 홈으로 이동">
              <Image src={fairgroundLogo.src} alt={fairgroundLogo.alt} width={1000} height={187} priority />
            </Link>
            <span aria-hidden="true">×</span>
            <span className={styles.heroSponsorLogo} data-logo-treatment={sponsor.logoTreatment ?? "plain"}>
              <Image src={sponsor.logo.src} alt={sponsor.logo.alt} width={189} height={80} priority />
            </span>
          </div>
          <div className={styles.heroEyebrow}>{hero.eyebrow}</div>
          <h1>{hero.title}</h1>
          <div className={styles.heroRule} aria-hidden="true" />
          <p className={styles.heroBenefits}>{hero.benefits}</p>
          <p className={styles.heroPrice}>{hero.priceSummary}</p>
          <p className={styles.heroMeta}>
            {event.date} · {event.time}
            <br />
            {event.venue} · {event.category}
          </p>
        </div>
        <figure className={styles.heroPhoto}>
          <div className={styles.heroImageFrame}>
            <Image src={hero.image.src} alt={hero.image.alt} fill sizes="(max-width: 900px) 100vw, 52vw" priority />
          </div>
          <figcaption>
            <b>{hero.caption}</b>
            <span>{sponsor.name} TEAMWEAR</span>
          </figcaption>
        </figure>
      </div>
    </header>
  );
}
