import assert from "node:assert/strict";

const tasks = {
  submission: {
    name: "submission",
    version: "20261008010000",
    migrationName: "festival_survey",
    migrationFile: "20261008010000_festival_survey.sql",
    evidenceDirectory: "2026-10-08-festival-survey",
    testFile: "festival-survey-database.test.mjs",
    databaseEnvironment: "FESTIVAL_SURVEY_TEST_DATABASE_URL",
    appliedEnvironment: "FESTIVAL_SURVEY_TEST_MIGRATION_APPLIED",
    expectedAdditions: 8,
    strictBackupData: true,
    additionAllowed: row => row.identity.includes("festival_survey") || row.identity.includes("submit_festival_survey"),
  },
  results: {
    name: "results",
    version: "20261008020000",
    migrationName: "festival_survey_results",
    migrationFile: "20261008020000_festival_survey_results.sql",
    evidenceDirectory: "2026-10-08-festival-survey-results",
    testFile: "festival-survey-results-database.test.mjs",
    databaseEnvironment: "FESTIVAL_SURVEY_RESULTS_TEST_DATABASE_URL",
    appliedEnvironment: "FESTIVAL_SURVEY_RESULTS_TEST_MIGRATION_APPLIED",
    expectedAdditions: 1,
    strictBackupData: false,
    additionAllowed: row => row.kind === "function" && row.identity === "public.get_festival_survey_results()",
  },
};

export function taskConfig(args) {
  const index = args.indexOf("--task");
  const name = index === -1 ? "submission" : args[index + 1];
  assert.ok(Object.hasOwn(tasks, name), "Supported survey tasks: submission, results.");
  return tasks[name];
}

export function assertAdditivePlan(task, diff) {
  assert.equal(diff.removed.length, 0, "Survey migration removes existing objects.");
  assert.equal(diff.changed.length, 0, "Survey migration changes existing definitions or grants.");
  assert.equal(diff.added.length, task.expectedAdditions, "Unexpected number of survey additions.");
  assert.ok(diff.added.every(task.additionAllowed), "Migration adds an object outside the exact task scope.");
}
