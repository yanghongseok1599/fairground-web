import { csvCell } from "../../../lib/csv-cell.ts";
import {
  CATEGORY_ITEMS, ENTRY_FEE_OPTIONS, MATCH_DURATION_OPTIONS, RETURN_INTENT_OPTIONS,
  ROLE_OPTIONS, RULES_OPINION_OPTIONS,
} from "../model.ts";
import type { SurveyResponse } from "./model.ts";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function optionLabel(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** One row per anonymous response, with all six grid rows in separate columns. */
export function createSurveyResponsesCsv(responses: readonly SurveyResponse[]): string {
  const headers = [
    "응답 번호", "제출 일시 (한국 시간)", "역할", "전반적 만족도 (1~5)", "추천 의향 (0~10)",
    "다음 대회 참가 의향", ...CATEGORY_ITEMS.map(({ label }) => `${label} (1~5)`),
    "대회 규정", "경기 시간 (12분)", "참가비", "가장 좋았던 점", "가장 아쉬웠거나 불편했던 점",
    "위험하거나 불편했던 순간", "추가되었으면 하는 것이나 기타 의견",
  ];
  const rows = responses.map(({ answers, createdAt }, index) => [
    index + 1, dateFormatter.format(new Date(createdAt)), optionLabel(ROLE_OPTIONS, answers.role),
    answers.overallSatisfaction, answers.recommendation, optionLabel(RETURN_INTENT_OPTIONS, answers.returnIntent),
    ...CATEGORY_ITEMS.map(({ key }) => answers.categoryRatings[key]),
    optionLabel(RULES_OPINION_OPTIONS, answers.rulesOpinion), optionLabel(MATCH_DURATION_OPTIONS, answers.matchDuration),
    optionLabel(ENTRY_FEE_OPTIONS, answers.entryFee), answers.bestMoment, answers.improvement,
    answers.safetyIncident, answers.suggestions,
  ]);
  return "\ufeff" + [headers, ...rows].map((row) => row.map((cell) => csvCell(cell, true)).join(",")).join("\r\n");
}

export function downloadSurveyResponsesCsv(responses: readonly SurveyResponse[]): void {
  const blob = new Blob([createSurveyResponsesCsv(responses)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "페어그라운드_페스티벌_설문결과.csv".normalize("NFC");
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser start consuming the blob before freeing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
