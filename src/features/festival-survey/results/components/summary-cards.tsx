import { BarChart3, Heart, Repeat2, Star, Users } from "lucide-react";
import { summarizeSurveyResponses } from "../model";
import { formatPercent, formatScore } from "./format";
import styles from "./survey-results.module.css";

export type SurveySummary = ReturnType<typeof summarizeSurveyResponses>;

export function SummaryCards({ summary }: { summary: SurveySummary }) {
  const cards = [
    { label: "응답 수", value: summary.count.toLocaleString("ko-KR"), unit: "건", detail: "현재 선택한 역할 기준", icon: Users },
    { label: "전반적인 만족도", value: formatScore(summary.overallAverage), unit: "/ 5", detail: "문항 2 · 평균 점수", icon: Star },
    { label: "추천 의향", value: formatScore(summary.recommendationAverage), unit: "/ 10", detail: "문항 3 · 평균 점수", icon: Heart },
    { label: "NPS", value: summary.nps === null ? "—" : `${summary.nps > 0 ? "+" : ""}${summary.nps.toFixed(1)}`, unit: "", detail: "추천 9~10점 비율 − 0~6점 비율", icon: BarChart3 },
    { label: "재참가 의향", value: formatPercent(summary.returnRate), unit: "", detail: "꼭 / 아마도 참가 응답 비율", icon: Repeat2 },
  ];

  return <div className={styles.summaryCards}>{cards.map(({ label, value, unit, detail, icon: Icon }) => (
    <article className={styles.summaryCard} key={label}>
      <div className={styles.cardLabel}><span>{label}</span><Icon size={17} aria-hidden="true" /></div>
      <p className={styles.metric}>{value}<span>{unit}</span></p>
      <p className={styles.metricDetail}>{detail}</p>
    </article>
  ))}</div>;
}
