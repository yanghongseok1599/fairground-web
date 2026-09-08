import Image from "next/image";
import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { SectionHeading } from "@/features/sponsor-proposal/components/section-heading";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

type SponsorResponseSectionProps = {
  sponsorName: string;
  response: NonNullable<SponsorProposal["sponsorResponse"]>;
};

export function SponsorResponseSection({ sponsorName, response }: SponsorResponseSectionProps) {
  return (
    <section id="response" className={`${styles.section} ${styles.responseSection}`}>
      <div className={styles.wrap}>
        <SectionHeading
          eyebrow={response.eyebrow}
          title={response.title}
          description={response.description}
          split
        />
        <div className={styles.responseGrid}>
          <div className={styles.responseAccepted} data-reveal>
            <span className={styles.responseLabel}>{sponsorName} 후원 제안 · 반영</span>
            <h3>제안해주신 1·2번은 그대로 반영합니다.</h3>
            <div className={styles.responseOfferList}>
              {response.accepted.map((offer) => (
                <article key={offer.title} className={styles.responseOffer}>
                  <h4>{offer.title}</h4>
                  <p>{offer.description}</p>
                  {offer.items.length > 0 ? (
                    <ul>
                      {offer.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
          <article className={styles.responseCounter} data-reveal>
            <span className={styles.responseCounterLabel}>03 · 요청드립니다.</span>
            <h3>{response.counterProposal.title}</h3>
            <p>{response.counterProposal.description}</p>
            {response.counterProposal.image ? (
              <figure className={styles.responseCounterVisual}>
                <div className={styles.responseCounterVisualFrame}>
                  <Image
                    src={response.counterProposal.image.src}
                    alt={response.counterProposal.image.alt}
                    fill
                    sizes="(max-width: 900px) 100vw, 44vw"
                  />
                </div>
                <figcaption>그라운드 챌린지 슈팅왕 대결 · 형광 연두 A팀 / 형광 핑크 B팀</figcaption>
              </figure>
            ) : null}
            <div className={styles.responsePlan}>
              {response.counterProposal.plan.map((step) => (
                <div key={step.label} className={styles.responsePlanRow}>
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </div>
              ))}
            </div>
            {response.counterProposal.additionalRequest ? (
              <div className={styles.responseAdditional}>
                <span>04 · 추가 협찬 요청</span>
                <div className={styles.responseAdditionalBody}>
                  {response.counterProposal.additionalRequest.image ? (
                    <div className={styles.responseAdditionalVisual}>
                      <Image
                        src={response.counterProposal.additionalRequest.image.src}
                        alt={response.counterProposal.additionalRequest.image.alt}
                        fill
                        sizes="(max-width: 620px) 100vw, 180px"
                      />
                    </div>
                  ) : null}
                  <div className={styles.responseAdditionalContent}>
                    <h4>{response.counterProposal.additionalRequest.title}</h4>
                    <p>{response.counterProposal.additionalRequest.description}</p>
                    <ul>
                      {response.counterProposal.additionalRequest.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {response.counterProposal.additionalRequest.link ? (
                      <a
                        href={response.counterProposal.additionalRequest.link.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {response.counterProposal.additionalRequest.link.label} ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            <div className={styles.responseDeliverables}>
              <span>준타스에 공유하는 결과물</span>
              <ul>
                {response.counterProposal.deliverables.map((deliverable) => (
                  <li key={deliverable}>{deliverable}</li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
