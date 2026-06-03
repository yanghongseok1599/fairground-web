import type { Position } from "@/types";

export type DuePaymentStatus = "pending" | "confirmed" | "waived";
export type ExpenseCategory = "court" | "referee" | "ball" | "uniform" | "food" | "etc";

export interface TeamDuePayment {
  playerId: string;
  amount: number;
  status: DuePaymentStatus;
}

export interface TeamExpense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
}

export interface DuesSummaryInput {
  amountPerMember: number;
  memberCount: number;
  payments: TeamDuePayment[];
  expenses: TeamExpense[];
}

export interface DuesSummary {
  expectedIncome: number;
  confirmedIncome: number;
  pendingIncome: number;
  expenseTotal: number;
  balance: number;
  paidCount: number;
  pendingCount: number;
  waivedCount: number;
  unpaidCount: number;
  completionRate: number;
}

export interface RosterInsightPlayer {
  id: string;
  position: Position;
  cardRating: number;
  stats: {
    goals: number;
    assists: number;
    games: number;
    mom: number;
  };
}

export interface RosterInsights {
  averageRating: number;
  totalGoals: number;
  totalAssists: number;
  topScorerId: string | null;
  topAssistId: string | null;
  positionCounts: Record<Position, number>;
}

const POSITIONS: Position[] = ["GK", "FIXO", "ALA", "PIVO"];

export function buildDuesSummary(input: DuesSummaryInput): DuesSummary {
  const expectedIncome = input.amountPerMember * input.memberCount;
  const confirmedPayments = input.payments.filter((payment) => payment.status === "confirmed");
  const pendingPayments = input.payments.filter((payment) => payment.status === "pending");
  const waivedPayments = input.payments.filter((payment) => payment.status === "waived");

  const confirmedIncome = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const pendingIncome = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const expenseTotal = input.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paidCount = confirmedPayments.length;
  const pendingCount = pendingPayments.length;
  const waivedCount = waivedPayments.length;
  const unpaidCount = Math.max(input.memberCount - paidCount - pendingCount - waivedCount, 0);
  const completionRate = input.memberCount > 0 ? Math.round((paidCount / input.memberCount) * 100) : 0;

  return {
    expectedIncome,
    confirmedIncome,
    pendingIncome,
    expenseTotal,
    balance: confirmedIncome - expenseTotal,
    paidCount,
    pendingCount,
    waivedCount,
    unpaidCount,
    completionRate,
  };
}

export function buildRosterInsights(players: RosterInsightPlayer[]): RosterInsights {
  const positionCounts = POSITIONS.reduce(
    (acc, position) => ({ ...acc, [position]: 0 }),
    {} as Record<Position, number>
  );

  let totalRating = 0;
  let totalGoals = 0;
  let totalAssists = 0;
  let topScorer: RosterInsightPlayer | null = null;
  let topAssist: RosterInsightPlayer | null = null;

  for (const player of players) {
    totalRating += player.cardRating;
    totalGoals += player.stats.goals;
    totalAssists += player.stats.assists;
    positionCounts[player.position] += 1;

    if (!topScorer || player.stats.goals > topScorer.stats.goals) {
      topScorer = player;
    }
    if (!topAssist || player.stats.assists > topAssist.stats.assists) {
      topAssist = player;
    }
  }

  return {
    averageRating: players.length > 0 ? Math.round(totalRating / players.length) : 0,
    totalGoals,
    totalAssists,
    topScorerId: topScorer?.id ?? null,
    topAssistId: topAssist?.id ?? null,
    positionCounts,
  };
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
