export const SURVEY_TITLE = "제1회 페어그라운드 혼성풋살페스티벌 만족도 조사";
export const SURVEY_DESCRIPTION = "대회에 참가해 주셔서 감사합니다. 보내주시는 의견은 다음 대회를 준비하는 데 가장 중요한 기준이 됩니다. 본 설문은 익명으로 진행되며, 소요 시간은 약 3분입니다. 좋았던 점과 아쉬웠던 점을 편하게 남겨주시기 바랍니다.";
export const TEXT_MAX_LENGTH = 3000;

export const ROLE_OPTIONS = [
  { value: "captain", label: "주장" },
  { value: "player", label: "선수" },
] as const;
export const RETURN_INTENT_OPTIONS = [
  { value: "definitely", label: "꼭 참가하겠습니다" },
  { value: "probably", label: "아마도 참가하겠습니다" },
  { value: "undecided", label: "고민 중입니다" },
  { value: "unable", label: "참가가 어렵습니다" },
] as const;
export const RULES_OPINION_OPTIONS = [
  { value: "appropriate", label: "안전을 위해 적절했습니다" },
  { value: "slightly_strict", label: "조금 과하다고 느꼈습니다" },
  { value: "too_strict", label: "많이 과하다고 느꼈습니다" },
  { value: "stricter_ok", label: "더 강화되어도 괜찮습니다" },
] as const;
export const MATCH_DURATION_OPTIONS = [
  { value: "short", label: "짧았습니다" },
  { value: "appropriate", label: "적당했습니다" },
  { value: "long", label: "길었습니다" },
] as const;
export const ENTRY_FEE_OPTIONS = [
  { value: "inexpensive", label: "저렴했습니다" },
  { value: "appropriate", label: "적당했습니다" },
  { value: "burdensome", label: "부담스러웠습니다" },
] as const;
export const CATEGORY_ITEMS = [
  { key: "referee", label: "심판 판정의 공정성" },
  { key: "safety", label: "안전 중심 운영" },
  { key: "schedule", label: "타임테이블 및 경기 간 대기 시간" },
  { key: "facilities", label: "구장 및 시설 환경" },
  { key: "communication", label: "사전 안내 및 소통" },
  { key: "program", label: "프로그램 (팀 소개, 몸풀기, 그라운드 챌린지, 시상식, 부스)" },
] as const;
export const SATISFACTION_OPTIONS = [
  { value: 1, label: "매우 불만족" },
  { value: 2, label: "불만족" },
  { value: 3, label: "보통" },
  { value: 4, label: "만족" },
  { value: 5, label: "매우 만족" },
] as const;
export const QUESTION_TITLES = {
  role: "역할을 선택해 주십시오.",
  overallSatisfaction: "이번 대회에 대한 전반적인 만족도는 어떠셨습니까?",
  recommendation: "이번 대회를 지인에게 추천할 의향은 어느 정도입니까?",
  returnIntent: "다음 대회에 다시 참가할 의향이 있으십니까?",
  categoryRatings: "항목별 만족도를 선택해 주십시오.",
  rulesOpinion: "이번 대회의 규정(강슛, 슬라이딩, 몸싸움 제한 등)은 어떻게 느끼셨습니까?",
  matchDuration: "경기 시간(12분)은 어떠셨습니까?",
  entryFee: "참가비는 어떻게 느끼셨습니까?",
  bestMoment: "가장 좋았던 점을 한 가지만 적어주십시오.",
  improvement: "가장 아쉬웠거나 불편했던 점을 한 가지만 적어주십시오.",
  safetyIncident: "경기 중 위험하거나 불편하다고 느끼신 순간이 있었다면 적어주십시오.",
  suggestions: "다음 대회에 추가되었으면 하는 것이나 기타 의견을 자유롭게 적어주십시오.",
} as const;

type OptionValue<T extends readonly { value: string }[]> = T[number]["value"];
export type CategoryKey = typeof CATEGORY_ITEMS[number]["key"];
export type SurveyAnswers = {
  role: OptionValue<typeof ROLE_OPTIONS> | null;
  overallSatisfaction: number | null;
  recommendation: number | null;
  returnIntent: OptionValue<typeof RETURN_INTENT_OPTIONS> | null;
  categoryRatings: Record<CategoryKey, number | null>;
  rulesOpinion: OptionValue<typeof RULES_OPINION_OPTIONS> | null;
  matchDuration: OptionValue<typeof MATCH_DURATION_OPTIONS> | null;
  entryFee: OptionValue<typeof ENTRY_FEE_OPTIONS> | null;
  bestMoment: string;
  improvement: string;
  safetyIncident: string;
  suggestions: string;
};
export type ValidatedSurveyAnswers = {
  [K in keyof SurveyAnswers]: K extends "categoryRatings"
    ? Record<CategoryKey, number>
    : NonNullable<SurveyAnswers[K]>;
};
export type SurveyField = keyof SurveyAnswers | `categoryRatings.${CategoryKey}` | "responseId" | "form";
export type SurveyErrors = Partial<Record<SurveyField, string>>;
export type SurveySubmission = { responseId: string; answers: ValidatedSurveyAnswers };
export type ValidationResult<T> = { success: true; value: T } | { success: false; errors: SurveyErrors };

export function createEmptySurveyAnswers(): SurveyAnswers {
  return {
    role: null, overallSatisfaction: null, recommendation: null, returnIntent: null,
    categoryRatings: { referee: null, safety: null, schedule: null, facilities: null, communication: null, program: null },
    rulesOpinion: null, matchDuration: null, entryFee: null,
    bestMoment: "", improvement: "", safetyIncident: "", suggestions: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isScore(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function isOption<T extends readonly { value: string }[]>(value: unknown, options: T): value is OptionValue<T> {
  return options.some((option) => option.value === value);
}

/** Rebuild from an allowlist: names, teams, member IDs and other extra fields never enter storage. */
export function validateSurveyAnswers(input: unknown): ValidationResult<ValidatedSurveyAnswers> {
  if (!isRecord(input)) return { success: false, errors: { form: "설문 응답을 확인해 주세요." } };
  const errors: SurveyErrors = {};
  if (Object.keys(input).some((key) => !Object.hasOwn(QUESTION_TITLES, key))) errors.form = "허용되지 않은 응답 항목이 있습니다.";
  if (!isOption(input.role, ROLE_OPTIONS)) errors.role = "역할을 선택해 주세요.";
  if (!isScore(input.overallSatisfaction, 1, 5)) errors.overallSatisfaction = "만족도를 1~5점 중 선택해 주세요.";
  if (!isScore(input.recommendation, 0, 10)) errors.recommendation = "추천 의향을 0~10점 중 선택해 주세요.";
  if (!isOption(input.returnIntent, RETURN_INTENT_OPTIONS)) errors.returnIntent = "다음 대회 참가 의향을 선택해 주세요.";
  const categoryRatings = {} as Record<CategoryKey, number>;
  const categories = isRecord(input.categoryRatings) ? input.categoryRatings : {};
  if (Object.keys(categories).some((key) => !CATEGORY_ITEMS.some((item) => item.key === key))) errors.categoryRatings = "항목별 만족도를 확인해 주세요.";
  for (const { key, label } of CATEGORY_ITEMS) {
    const score = categories[key];
    if (!isScore(score, 1, 5)) errors[`categoryRatings.${key}`] = `${label} 만족도를 선택해 주세요.`;
    else categoryRatings[key] = score;
  }
  if (!isOption(input.rulesOpinion, RULES_OPINION_OPTIONS)) errors.rulesOpinion = "대회 규정에 대한 의견을 선택해 주세요.";
  if (!isOption(input.matchDuration, MATCH_DURATION_OPTIONS)) errors.matchDuration = "경기 시간에 대한 의견을 선택해 주세요.";
  if (!isOption(input.entryFee, ENTRY_FEE_OPTIONS)) errors.entryFee = "참가비에 대한 의견을 선택해 주세요.";
  const textAnswers = { bestMoment: "", improvement: "", safetyIncident: "", suggestions: "" };
  for (const field of Object.keys(textAnswers) as (keyof typeof textAnswers)[]) {
    const required = field === "bestMoment" || field === "improvement";
    const value = input[field] === undefined && !required ? "" : input[field];
    if (typeof value !== "string") { errors[field] = required ? "의견을 입력해 주세요." : "의견은 글자로 입력해 주세요."; continue; }
    const normalized = value.trim();
    if (normalized.includes("\u0000")) errors[field] = "입력할 수 없는 문자가 포함되어 있습니다.";
    else if (normalized.length > TEXT_MAX_LENGTH) errors[field] = `${TEXT_MAX_LENGTH.toLocaleString("ko-KR")}자 이내로 입력해 주세요.`;
    else if (required && !normalized) errors[field] = "의견을 입력해 주세요. 없으시면 ‘없음’이라고 적어 주세요.";
    textAnswers[field] = normalized;
  }
  if (Object.keys(errors).length) return { success: false, errors };
  return { success: true, value: {
    role: input.role as ValidatedSurveyAnswers["role"],
    overallSatisfaction: input.overallSatisfaction as number,
    recommendation: input.recommendation as number,
    returnIntent: input.returnIntent as ValidatedSurveyAnswers["returnIntent"], categoryRatings,
    rulesOpinion: input.rulesOpinion as ValidatedSurveyAnswers["rulesOpinion"],
    matchDuration: input.matchDuration as ValidatedSurveyAnswers["matchDuration"],
    entryFee: input.entryFee as ValidatedSurveyAnswers["entryFee"], ...textAnswers,
  } };
}

export function parseSurveySubmission(input: unknown): ValidationResult<SurveySubmission> {
  if (!isRecord(input)) return { success: false, errors: { form: "설문 응답을 확인해 주세요." } };
  const result = validateSurveyAnswers(input.answers);
  const errors: SurveyErrors = result.success ? {} : { ...result.errors };
  if (Object.keys(input).some((key) => key !== "responseId" && key !== "answers")) errors.form = "허용되지 않은 응답 항목이 있습니다.";
  if (typeof input.responseId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.responseId)) {
    errors.responseId = "응답 식별자를 확인할 수 없습니다. 페이지를 새로고침해 주세요.";
  }
  if (!result.success || Object.keys(errors).length) return { success: false, errors };
  return { success: true, value: { responseId: (input.responseId as string).toLowerCase(), answers: result.value } };
}

/** The six category rows count as one question; the two free optional answers stay optional. */
export function countAnsweredQuestions(answers: SurveyAnswers): number {
  return [
    isOption(answers.role, ROLE_OPTIONS), isScore(answers.overallSatisfaction, 1, 5),
    isScore(answers.recommendation, 0, 10), isOption(answers.returnIntent, RETURN_INTENT_OPTIONS),
    CATEGORY_ITEMS.every(({ key }) => isScore(answers.categoryRatings[key], 1, 5)),
    isOption(answers.rulesOpinion, RULES_OPINION_OPTIONS), isOption(answers.matchDuration, MATCH_DURATION_OPTIONS),
    isOption(answers.entryFee, ENTRY_FEE_OPTIONS), Boolean(answers.bestMoment.trim()), Boolean(answers.improvement.trim()),
    Boolean(answers.safetyIncident.trim()), Boolean(answers.suggestions.trim()),
  ].filter(Boolean).length;
}
