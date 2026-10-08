import {
  CATEGORY_ITEMS, ENTRY_FEE_OPTIONS, MATCH_DURATION_OPTIONS, QUESTION_TITLES,
  RETURN_INTENT_OPTIONS, RULES_OPINION_OPTIONS, SATISFACTION_OPTIONS,
} from "../../model";
import { formatScore } from "./format";
import type { SurveySummary } from "./summary-cards";
import styles from "./survey-results.module.css";

type DistributionOption = { value: string | number; label: string };

function DistributionCard({ number, title, options, counts, total }: {
  number: number;
  title: string;
  options: readonly DistributionOption[];
  counts: Record<string | number, number>;
  total: number;
}) {
  return <article className={styles.distributionCard}>
    <div className={styles.panelHeading}><span className={styles.questionTag}>Q{String(number).padStart(2, "0")}</span><h3>{title}</h3></div>
    <ul className={styles.distributionRows}>{options.map((option) => {
      const count = counts[option.value] ?? 0;
      const percent = total ? count / total * 100 : 0;
      return <li key={option.value}>
        <div className={styles.distributionLabel}><span>{option.label}</span><span><strong>{count}</strong>건 <small>({percent.toFixed(1)}%)</small></span></div>
        <div className={styles.barTrack} aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
      </li>;
    })}</ul>
  </article>;
}

export function DistributionPanels({ summary }: { summary: SurveySummary }) {
  const recommendationOptions = Array.from({ length: 11 }, (_, value) => ({ value, label: `${value}점${value === 0 ? " · 전혀 추천하지 않음" : value === 10 ? " · 적극 추천" : ""}` }));
  return <>
    <section aria-labelledby="survey-distributions-title" className={styles.dashboardSection}>
      <div className={styles.sectionTitle}><div><h2 id="survey-distributions-title">응답 분포</h2><p>각 선택지의 응답 수와 비율을 확인하세요.</p></div><span className={styles.dataNote}>{summary.count}건 기준</span></div>
      <div className={styles.distributionGrid}>
        <DistributionCard number={2} title={QUESTION_TITLES.overallSatisfaction} options={SATISFACTION_OPTIONS.map(({ value, label }) => ({ value, label: `${value} ${label}` }))} counts={summary.distributions.overallSatisfaction} total={summary.count} />
        <DistributionCard number={4} title={QUESTION_TITLES.returnIntent} options={RETURN_INTENT_OPTIONS} counts={summary.distributions.returnIntent} total={summary.count} />
        <DistributionCard number={3} title={QUESTION_TITLES.recommendation} options={recommendationOptions} counts={summary.distributions.recommendation} total={summary.count} />
        <div className={styles.operationDistributions}>
          <DistributionCard number={6} title={QUESTION_TITLES.rulesOpinion} options={RULES_OPINION_OPTIONS} counts={summary.distributions.rulesOpinion} total={summary.count} />
          <DistributionCard number={7} title={QUESTION_TITLES.matchDuration} options={MATCH_DURATION_OPTIONS} counts={summary.distributions.matchDuration} total={summary.count} />
          <DistributionCard number={8} title={QUESTION_TITLES.entryFee} options={ENTRY_FEE_OPTIONS} counts={summary.distributions.entryFee} total={summary.count} />
        </div>
      </div>
    </section>
    <section aria-labelledby="survey-categories-title" className={styles.dashboardSection}>
      <div className={styles.sectionTitle}><div><h2 id="survey-categories-title">항목별 만족도</h2><p>운영 항목별 평균 점수와 1~5점 응답 분포입니다.</p></div><span className={styles.dataNote}>Q05 · 5점 만점</span></div>
      <div className={styles.categoryPanel}>
        <div className={styles.categoryScaleLegend}>{SATISFACTION_OPTIONS.map(({ value, label }) => <span key={value}><i className={styles[`score${value}`]} aria-hidden="true" />{value} {label}</span>)}</div>
        <div className={styles.categoryRows}>{CATEGORY_ITEMS.map(({ key, label }) => (
          <article className={styles.categoryResult} key={key}>
            <div className={styles.categoryResultTitle}><h3>{label}</h3><strong>{formatScore(summary.categoryAverages[key])}<small> / 5</small></strong></div>
            <div className={styles.stackedBar} aria-hidden="true">{SATISFACTION_OPTIONS.map(({ value }) => <span key={value} className={styles[`score${value}`]} style={{ width: `${summary.count ? summary.categoryCounts[key][value] / summary.count * 100 : 0}%` }} />)}</div>
            <div className={styles.categoryCounts}>{SATISFACTION_OPTIONS.map(({ value, label }) => <span key={value} aria-label={`${value} ${label} ${summary.categoryCounts[key][value]}건`}><i className={styles[`score${value}`]} aria-hidden="true" />{value}점 <strong>{summary.categoryCounts[key][value]}</strong>건</span>)}</div>
          </article>
        ))}</div>
      </div>
    </section>
  </>;
}
