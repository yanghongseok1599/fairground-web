import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_ITEMS, countAnsweredQuestions, createEmptySurveyAnswers, parseSurveySubmission, TEXT_MAX_LENGTH, validateSurveyAnswers } from "../src/features/festival-survey/model.ts";
import type { SurveyAnswers } from "../src/features/festival-survey/model.ts";

const responseId = "66526e15-3744-45e5-95a2-6e84ef7603a4";
function validAnswers(): SurveyAnswers {
  return { ...createEmptySurveyAnswers(), role: "captain", overallSatisfaction: 5, recommendation: 0,
    returnIntent: "probably", categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
    rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate",
    bestMoment: "  함께한 경기  ", improvement: "\n없음\t", safetyIncident: "", suggestions: "" };
}

test("all ten required questions validate, recommendation zero is an answer, and optional text remains optional", () => {
  const answers = validAnswers();
  const result = parseSurveySubmission({ responseId: responseId.toUpperCase(), answers });
  assert.ok(result.success);
  if (!result.success) return;
  assert.equal(result.value.responseId, responseId);
  assert.equal(result.value.answers.recommendation, 0);
  assert.equal(result.value.answers.bestMoment, "함께한 경기");
  assert.equal(result.value.answers.improvement, "없음");
  assert.equal(countAnsweredQuestions(answers), 10);
  const optional = { ...answers } as Partial<SurveyAnswers>;
  delete optional.safetyIncident; delete optional.suggestions;
  const omitted = validateSurveyAnswers(optional);
  assert.ok(omitted.success);
  if (omitted.success) assert.equal(omitted.value.suggestions, "");
});

test("every required question and all category rows must be answered", () => {
  const empty = validateSurveyAnswers(createEmptySurveyAnswers());
  assert.equal(empty.success, false);
  assert.equal(countAnsweredQuestions(createEmptySurveyAnswers()), 0);
  for (const key of ["role", "overallSatisfaction", "recommendation", "returnIntent", "categoryRatings", "rulesOpinion", "matchDuration", "entryFee", "bestMoment", "improvement"]) {
    const missing = { ...validAnswers() } as Record<string, unknown>; delete missing[key];
    assert.equal(validateSurveyAnswers(missing).success, false, key);
  }
  for (const { key } of CATEGORY_ITEMS) {
    const answers = validAnswers(); answers.categoryRatings[key] = null;
    const result = validateSurveyAnswers(answers);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.errors[`categoryRatings.${key}`]);
  }
});

test("numbers are bounded integers and do not coerce strings, null or empty answers", () => {
  for (const score of [-1, 6, 1.5, "5", null, NaN, Infinity]) {
    assert.equal(validateSurveyAnswers({ ...validAnswers(), overallSatisfaction: score }).success, false);
  }
  for (const score of [-1, 11, 0.1, "0", null, NaN, Infinity]) {
    assert.equal(validateSurveyAnswers({ ...validAnswers(), recommendation: score }).success, false);
  }
  for (const score of [0, 6, 1.5, "4", null]) {
    const answers = validAnswers();
    assert.equal(validateSurveyAnswers({ ...answers, categoryRatings: { ...answers.categoryRatings, referee: score } }).success, false);
  }
});

test("required free text rejects Unicode whitespace, excessive length, and null characters", () => {
  for (const text of ["", " \t\r\n", "\u00a0\u3000\ufeff", "x".repeat(TEXT_MAX_LENGTH + 1), null, 42, "x\u0000y"]) {
    assert.equal(validateSurveyAnswers({ ...validAnswers(), bestMoment: text }).success, false);
  }
  assert.ok(validateSurveyAnswers({ ...validAnswers(), bestMoment: "x".repeat(TEXT_MAX_LENGTH) }).success);
  assert.equal(validateSurveyAnswers({ ...validAnswers(), suggestions: "x".repeat(TEXT_MAX_LENGTH + 1) }).success, false);
});

test("unknown choices, identity metadata, malformed envelopes and invalid response IDs are rejected", () => {
  for (const key of ["role", "returnIntent", "rulesOpinion", "matchDuration", "entryFee"]) {
    assert.equal(validateSurveyAnswers({ ...validAnswers(), [key]: "unknown" }).success, false);
  }
  for (const key of ["name", "teamId", "userId", "ip", "toString"]) {
    assert.equal(validateSurveyAnswers({ ...validAnswers(), [key]: "private" }).success, false);
  }
  assert.equal(validateSurveyAnswers({ ...validAnswers(), categoryRatings: { ...validAnswers().categoryRatings, name: "private" } }).success, false);
  for (const input of [undefined, null, [], "answers", { responseId }, { responseId, answers: null }, { responseId, answers: validAnswers(), memberId: "private" }]) {
    assert.equal(parseSurveySubmission(input).success, false);
  }
  for (const id of ["", "abc", null, "00000000-0000-0000-0000-000000000000"]) {
    assert.equal(parseSurveySubmission({ responseId: id, answers: validAnswers() }).success, false);
  }
});
