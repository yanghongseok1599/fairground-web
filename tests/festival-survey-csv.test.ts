import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurveyResponsesCsv } from "../src/features/festival-survey/results/export-csv.ts";
import type { SurveyResponse } from "../src/features/festival-survey/results/model.ts";

function response(): SurveyResponse {
  return {
    responseId: "66526e15-3744-45e5-95a2-6e84ef7603a4", createdAt: "2026-10-08T00:12:34Z",
    answers: {
      role: "captain", overallSatisfaction: 5, recommendation: 0, returnIntent: "probably",
      categoryRatings: { referee: 1, safety: 2, schedule: 3, facilities: 4, communication: 5, program: 1 },
      rulesOpinion: "slightly_strict", matchDuration: "short", entryFee: "burdensome",
      bestMoment: '함께한 경기, "즐거웠어요"\n다음에도!', improvement: "=HYPERLINK(\"https://example.com\")",
      safetyIncident: "\t+SUM(1,1)", suggestions: "@SUM(1,1)",
    },
  };
}

test("CSV preserves Korean, all survey fields, zero scores, quotes and multiline text without identity IDs", () => {
  const csv = createSurveyResponsesCsv([response()]);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes('"2026-10-08 09:12:34"'));
  assert.ok(csv.includes('"주장","5","0","아마도 참가하겠습니다","1","2","3","4","5","1"'));
  assert.ok(csv.includes('"조금 과하다고 느꼈습니다","짧았습니다","부담스러웠습니다"'));
  assert.ok(csv.includes('"함께한 경기, ""즐거웠어요""\n다음에도!"'));
  assert.equal(csv.includes(response().responseId), false);
  assert.equal(csv.includes("undefined"), false);
});

test("free text cannot become a spreadsheet formula", () => {
  const csv = createSurveyResponsesCsv([response()]);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes('"\'\t+SUM(1,1)"'));
  assert.ok(csv.includes('"\'@SUM(1,1)"'));
});

test("an empty export still has every question as a labelled column", () => {
  const csv = createSurveyResponsesCsv([]);
  assert.equal(csv.split("\r\n").length, 1);
  assert.ok(csv.includes("가장 좋았던 점"));
  assert.ok(csv.includes("추가되었으면 하는 것이나 기타 의견"));
});
