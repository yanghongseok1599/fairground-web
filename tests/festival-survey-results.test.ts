import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_ITEMS, createEmptySurveyAnswers } from "../src/features/festival-survey/model.ts";
import type { CategoryKey, ValidatedSurveyAnswers } from "../src/features/festival-survey/model.ts";
import { filterSurveyResponses, parseSurveyResponses, summarizeSurveyResponses } from "../src/features/festival-survey/results/model.ts";
import type { SurveyResponse } from "../src/features/festival-survey/results/model.ts";

function response(index: number, overallSatisfaction = 5, recommendation = 10, role: "captain" | "player" = "captain"): SurveyResponse {
  return { responseId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, createdAt: "2026-10-08T12:30:00.123456+00:00",
    answers: { ...createEmptySurveyAnswers(), role, overallSatisfaction, recommendation, returnIntent: "definitely",
      categoryRatings: Object.fromEntries(CATEGORY_ITEMS.map(({ key }) => [key, overallSatisfaction])) as Record<CategoryKey, number>,
      rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate", bestMoment: "즐거운 경기", improvement: "없음" } as ValidatedSurveyAnswers };
}

test("an empty result has zero distributions and no invented average or rate", () => {
  const summary = summarizeSurveyResponses([]);
  assert.equal(summary.count, 0);
  for (const key of ["overallAverage", "recommendationAverage", "nps", "returnRate"] as const) assert.equal(summary[key], null);
  for (const distribution of Object.values(summary.distributions)) assert.ok(Object.values(distribution).every((count) => count === 0));
  for (const { key } of CATEGORY_ITEMS) {
    assert.equal(summary.categoryAverages[key], null);
    assert.deepEqual(summary.categoryCounts[key], { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  }
});

test("all averages, NPS, return rate and distributions include recommendation zero", () => {
  const first = response(1, 5, 0);
  const second = response(2, 1, 7, "player"); second.answers.returnIntent = "probably";
  const third = response(3, 3, 10); third.answers.returnIntent = "unable";
  const responses = [first, second, third];
  const before = JSON.stringify(responses);
  const summary = summarizeSurveyResponses(responses);
  assert.equal(summary.count, 3);
  assert.equal(summary.overallAverage, 3);
  assert.equal(summary.recommendationAverage, 17 / 3);
  assert.equal(summary.nps, 0);
  assert.equal(summary.returnRate, 2 / 3 * 100);
  assert.deepEqual(summary.distributions.role, { captain: 2, player: 1 });
  assert.deepEqual(summary.distributions.overallSatisfaction, { 1: 1, 2: 0, 3: 1, 4: 0, 5: 1 });
  assert.equal(summary.distributions.recommendation[0], 1);
  assert.equal(summary.distributions.recommendation[7], 1);
  assert.equal(summary.distributions.recommendation[10], 1);
  assert.equal(summary.distributions.rulesOpinion.appropriate, 3);
  for (const { key } of CATEGORY_ITEMS) {
    assert.equal(summary.categoryAverages[key], 3);
    assert.deepEqual(summary.categoryCounts[key], { 1: 1, 2: 0, 3: 1, 4: 0, 5: 1 });
  }
  assert.equal(JSON.stringify(responses), before);
});

test("NPS boundaries 0–6, 7–8 and 9–10 are counted correctly", () => {
  for (let score = 0; score <= 10; score++) {
    assert.equal(summarizeSurveyResponses([response(score + 1, 5, score)]).nps, score <= 6 ? -100 : score <= 8 ? 0 : 100);
  }
  const undecided = response(1); undecided.answers.returnIntent = "undecided";
  assert.equal(summarizeSurveyResponses([undecided]).returnRate, 0);
});

test("role filtering preserves every row and calculates metrics within the selected role", () => {
  const responses = [response(1, 5, 10), response(2, 1, 0, "player"), response(3, 3, 8)];
  assert.deepEqual(filterSurveyResponses(responses, "all"), responses);
  assert.deepEqual(filterSurveyResponses(responses, "captain").map(({ responseId }) => responseId), [responses[0].responseId, responses[2].responseId]);
  const player = summarizeSurveyResponses(filterSurveyResponses(responses, "player"));
  assert.equal(player.count, 1); assert.equal(player.overallAverage, 1); assert.equal(player.nps, -100);
});

test("runtime parsing validates every answer, UUID and timestamp without silently dropping bad rows", () => {
  const valid = response(1);
  assert.deepEqual(parseSurveyResponses({ responses: [valid] }), [valid]);
  assert.deepEqual(parseSurveyResponses({ responses: [] }), []);
  for (const input of [null, [], {}, { responses: null }, { responses: [], userId: "private" },
    { responses: [{ ...valid, member: "private" }] }, { responses: [{ ...valid, responseId: "invalid" }] },
    { responses: [{ ...valid, createdAt: "2026" }] }, { responses: [{ ...valid, createdAt: "invalid" }] },
    { responses: [{ ...valid, answers: { ...valid.answers, recommendation: null } }] },
    { responses: [{ ...valid, answers: { ...valid.answers, name: "private" } }] },
    { responses: [valid, valid] }, { responses: [valid, null] }]) {
    assert.throws(() => parseSurveyResponses(input), /설문 결과 형식/);
  }
});

test("more than one thousand returned answers remain complete in parsing and aggregation", () => {
  const responses = Array.from({ length: 1001 }, (_, index) => response(index + 1, 5, index === 1000 ? 0 : 10));
  const parsed = parseSurveyResponses({ responses });
  const summary = summarizeSurveyResponses(parsed);
  assert.equal(summary.count, 1001);
  assert.equal(summary.distributions.recommendation[0], 1);
  assert.equal(summary.distributions.recommendation[10], 1000);
  assert.equal(summary.nps, 999 / 1001 * 100);
});
