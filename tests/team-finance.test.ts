import assert from "node:assert/strict";
import {
  buildDuesSummary,
  buildRosterInsights,
  type TeamDuePayment,
  type TeamExpense,
} from "../src/lib/team-finance.ts";

const payments: TeamDuePayment[] = [
  { playerId: "p1", amount: 20000, status: "confirmed" },
  { playerId: "p2", amount: 20000, status: "pending" },
  { playerId: "p3", amount: 0, status: "waived" },
];

const expenses: TeamExpense[] = [
  { id: "e1", title: "풋살장", amount: 120000, category: "court" },
  { id: "e2", title: "음료", amount: 18000, category: "food" },
];

const summary = buildDuesSummary({
  amountPerMember: 20000,
  memberCount: 12,
  payments,
  expenses,
});

assert.equal(summary.expectedIncome, 240000);
assert.equal(summary.confirmedIncome, 20000);
assert.equal(summary.pendingIncome, 20000);
assert.equal(summary.expenseTotal, 138000);
assert.equal(summary.balance, -118000);
assert.equal(summary.paidCount, 1);
assert.equal(summary.pendingCount, 1);
assert.equal(summary.waivedCount, 1);
assert.equal(summary.unpaidCount, 9);
assert.equal(summary.completionRate, 8);

const roster = buildRosterInsights([
  { id: "a", position: "GK", cardRating: 91, stats: { goals: 0, assists: 1, games: 5, mom: 0 } },
  { id: "b", position: "ALA", cardRating: 94, stats: { goals: 7, assists: 3, games: 6, mom: 1 } },
  { id: "c", position: "PIVO", cardRating: 88, stats: { goals: 4, assists: 5, games: 4, mom: 2 } },
]);

assert.equal(roster.averageRating, 91);
assert.equal(roster.totalGoals, 11);
assert.equal(roster.totalAssists, 9);
assert.equal(roster.topScorerId, "b");
assert.equal(roster.topAssistId, "c");
assert.deepEqual(roster.positionCounts, { GK: 1, FIXO: 0, ALA: 1, PIVO: 1 });

console.log("team-finance tests passed");
