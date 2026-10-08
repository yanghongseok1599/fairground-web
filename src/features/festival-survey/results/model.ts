import {
  CATEGORY_ITEMS, ENTRY_FEE_OPTIONS, MATCH_DURATION_OPTIONS, parseSurveySubmission,
  RETURN_INTENT_OPTIONS, ROLE_OPTIONS, RULES_OPINION_OPTIONS, SATISFACTION_OPTIONS,
} from "../model.ts";
import type { CategoryKey, ValidatedSurveyAnswers } from "../model.ts";

export type SurveyResponse = { responseId: string; createdAt: string; answers: ValidatedSurveyAnswers };
export type RoleFilter = "all" | ValidatedSurveyAnswers["role"];
export type SatisfactionRating = typeof SATISFACTION_OPTIONS[number]["value"];
export type RecommendationScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SurveyDistributions = {
  role: Record<ValidatedSurveyAnswers["role"], number>;
  overallSatisfaction: Record<SatisfactionRating, number>;
  recommendation: Record<RecommendationScore, number>;
  returnIntent: Record<ValidatedSurveyAnswers["returnIntent"], number>;
  rulesOpinion: Record<ValidatedSurveyAnswers["rulesOpinion"], number>;
  matchDuration: Record<ValidatedSurveyAnswers["matchDuration"], number>;
  entryFee: Record<ValidatedSurveyAnswers["entryFee"], number>;
};
export type SurveySummary = {
  count: number;
  overallAverage: number | null;
  recommendationAverage: number | null;
  /** Promoters (9–10) minus detractors (0–6), as a percentage of all responses. */
  nps: number | null;
  /** Definitely/probably returning, as a percentage of all responses. */
  returnRate: number | null;
  categoryAverages: Record<CategoryKey, number | null>;
  distributions: SurveyDistributions;
  categoryCounts: Record<CategoryKey, Record<SatisfactionRating, number>>;
};

const RECOMMENDATION_SCORES: readonly RecommendationScore[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
function counts<T extends string | number>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

export function filterSurveyResponses(responses: readonly SurveyResponse[], filter: RoleFilter): SurveyResponse[] {
  return responses.filter((response) => filter === "all" || response.answers.role === filter);
}

export function summarizeSurveyResponses(responses: readonly SurveyResponse[]): SurveySummary {
  const distributions: SurveyDistributions = {
    role: counts(ROLE_OPTIONS.map((option) => option.value)),
    overallSatisfaction: counts(SATISFACTION_OPTIONS.map((option) => option.value)),
    recommendation: counts(RECOMMENDATION_SCORES),
    returnIntent: counts(RETURN_INTENT_OPTIONS.map((option) => option.value)),
    rulesOpinion: counts(RULES_OPINION_OPTIONS.map((option) => option.value)),
    matchDuration: counts(MATCH_DURATION_OPTIONS.map((option) => option.value)),
    entryFee: counts(ENTRY_FEE_OPTIONS.map((option) => option.value)),
  };
  const categoryCounts = Object.fromEntries(CATEGORY_ITEMS.map(({ key }) => [key, counts(SATISFACTION_OPTIONS.map((option) => option.value))])) as SurveySummary["categoryCounts"];
  const categorySums = counts(CATEGORY_ITEMS.map(({ key }) => key));
  let overallSum = 0;
  let recommendationSum = 0;
  let promoters = 0;
  let detractors = 0;
  for (const { answers } of responses) {
    distributions.role[answers.role]++;
    distributions.overallSatisfaction[answers.overallSatisfaction as SatisfactionRating]++;
    distributions.recommendation[answers.recommendation as RecommendationScore]++;
    distributions.returnIntent[answers.returnIntent]++;
    distributions.rulesOpinion[answers.rulesOpinion]++;
    distributions.matchDuration[answers.matchDuration]++;
    distributions.entryFee[answers.entryFee]++;
    overallSum += answers.overallSatisfaction;
    recommendationSum += answers.recommendation;
    if (answers.recommendation >= 9) promoters++;
    if (answers.recommendation <= 6) detractors++;
    for (const { key } of CATEGORY_ITEMS) {
      const rating = answers.categoryRatings[key];
      categorySums[key] += rating;
      categoryCounts[key][rating as SatisfactionRating]++;
    }
  }
  const count = responses.length;
  return {
    count, distributions, categoryCounts,
    overallAverage: count ? overallSum / count : null,
    recommendationAverage: count ? recommendationSum / count : null,
    nps: count ? (promoters - detractors) / count * 100 : null,
    returnRate: count ? (distributions.returnIntent.definitely + distributions.returnIntent.probably) / count * 100 : null,
    categoryAverages: Object.fromEntries(CATEGORY_ITEMS.map(({ key }) => [key, count ? categorySums[key] / count : null])) as SurveySummary["categoryAverages"],
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

/** Fail the whole read when a row is malformed; do not silently omit it from totals. */
export function parseSurveyResponses(input: unknown): SurveyResponse[] {
  const invalid = () => new Error("설문 결과 형식을 확인할 수 없습니다. 다시 불러와 주세요.");
  if (!isRecord(input) || Object.keys(input).length !== 1 || !Array.isArray(input.responses)) throw invalid();
  const seenIds = new Set<string>();
  return input.responses.map((row: unknown) => {
    if (!isRecord(row) || Object.keys(row).length !== 3 || Object.keys(row).some((key) => !["responseId", "answers", "createdAt"].includes(key))) throw invalid();
    const result = parseSurveySubmission({ responseId: row.responseId, answers: row.answers });
    if (!result.success || typeof row.createdAt !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(row.createdAt)
      || !Number.isFinite(Date.parse(row.createdAt))) throw invalid();
    if (seenIds.has(result.value.responseId)) throw invalid();
    seenIds.add(result.value.responseId);
    return { ...result.value, createdAt: row.createdAt };
  });
}
