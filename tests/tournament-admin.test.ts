import assert from "node:assert/strict";
import { buildTournamentDraft, formatTournamentSchedule, isValidTournamentDraft } from "../src/lib/tournament-admin.ts";

const draft = buildTournamentDraft({
  name: "  2026 봄 리그  ",
  date: "2026-06-01",
  location: " 서울 풋살파크 ",
});

assert.equal(draft.name, "2026 봄 리그");
assert.equal(draft.date, "2026-06-01");
assert.equal(draft.location, "서울 풋살파크");
assert.equal(draft.status, "upcoming");
assert.deepEqual(draft.groups, []);
assert.deepEqual(draft.matchIds, []);
assert.equal(typeof draft.createdAt, "number");
assert.ok(isValidTournamentDraft(draft));
assert.equal(isValidTournamentDraft(buildTournamentDraft({ name: "", date: "2026-06-01", location: "서울" })), false);
assert.equal(isValidTournamentDraft(buildTournamentDraft({ name: "리그", date: "", location: "서울" })), false);
assert.equal(isValidTournamentDraft(buildTournamentDraft({ name: "리그", date: "2026-06-01", location: "" })), false);

assert.equal(formatTournamentSchedule("2026-06-01", ""), "2026-06-01");
assert.equal(formatTournamentSchedule("2026-06-01", "2026-06-01"), "2026-06-01");
assert.equal(formatTournamentSchedule("2026-06-01", "2026-06-02"), "2026-06-01 ~ 2026-06-02");
assert.equal(formatTournamentSchedule(" 2026-06-01 ", " 2026-06-02 "), "2026-06-01 ~ 2026-06-02");

const twoDayDraft = buildTournamentDraft({
  name: "양일 컵",
  startDate: "2026-06-01",
  endDate: "2026-06-02",
  location: "서울",
});
assert.equal(twoDayDraft.date, "2026-06-01 ~ 2026-06-02");

console.log("tournament-admin tests passed");
