import {
  createEmptySurveyAnswers,
  CATEGORY_ITEMS, ROLE_OPTIONS, RETURN_INTENT_OPTIONS, RULES_OPINION_OPTIONS,
  MATCH_DURATION_OPTIONS, ENTRY_FEE_OPTIONS, TEXT_MAX_LENGTH,
  parseSurveySubmission,
  type SurveyAnswers, type SurveySubmission,
} from "./model";

const STORAGE_KEY = "fairground-festival-survey-v1";
export type StoredSurvey = {
  answers: SurveyAnswers;
  pending: SurveySubmission | null;
  submitted: boolean;
  confirmedResponseIds?: string[];
};

/** Unsubmitted drafts and completion receipts stay confined to the current tab. */
export function readStoredSurvey(): StoredSurvey | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSurvey;
    const empty = createEmptySurveyAnswers();
    if (!stored.answers || typeof stored.answers !== "object") return null;
    const choiceOptions = { role: ROLE_OPTIONS, returnIntent: RETURN_INTENT_OPTIONS, rulesOpinion: RULES_OPINION_OPTIONS, matchDuration: MATCH_DURATION_OPTIONS, entryFee: ENTRY_FEE_OPTIONS };
    for (const key of Object.keys(choiceOptions) as (keyof typeof choiceOptions)[]) {
      const value = stored.answers[key];
      if (choiceOptions[key].some((option) => option.value === value)) Object.assign(empty, { [key]: value });
    }
    for (const key of ["overallSatisfaction", "recommendation"] as const) {
      const value = stored.answers[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= (key === "recommendation" ? 0 : 1) && value <= (key === "recommendation" ? 10 : 5)) empty[key] = value;
    }
    for (const { key } of CATEGORY_ITEMS) {
      const value = stored.answers.categoryRatings?.[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) empty.categoryRatings[key] = value;
    }
    for (const key of ["bestMoment", "improvement", "safetyIncident", "suggestions"] as const) {
      const value = stored.answers[key];
      if (typeof value === "string") empty[key] = value.slice(0, TEXT_MAX_LENGTH);
    }
    const parsed = stored.pending ? parseSurveySubmission(stored.pending) : null;
    const confirmedResponseIds = Array.isArray(stored.confirmedResponseIds)
      ? stored.confirmedResponseIds.filter((id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)).map((id) => id.toLowerCase())
      : [];
    return { answers: empty, pending: parsed?.success ? parsed.value : null, submitted: stored.submitted === true, confirmedResponseIds };
  } catch { return null; }
}

export function persistSurvey(value: StoredSurvey): boolean {
  try {
    const serialized = JSON.stringify(value);
    sessionStorage.setItem(STORAGE_KEY, serialized);
    return sessionStorage.getItem(STORAGE_KEY) === serialized;
  } catch { return false; }
}
