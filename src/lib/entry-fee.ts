import {
  MIXED_FUTSAL_ENTRY_FEE_EARLY_AMOUNT,
  MIXED_FUTSAL_ENTRY_FEE_REGULAR_AMOUNT,
} from "./mixed-futsal-event.ts";

/**
 * 참가비 수납 상태.
 *   unpaid  — 미납
 *   partial — 일부 입금 (분할 납부·계좌 오차)
 *   paid    — 완납
 */
export type EntryFeeStatus = "unpaid" | "partial" | "paid";

export const ENTRY_FEE_STATUS_LABELS: Record<EntryFeeStatus, string> = {
  unpaid: "미납",
  partial: "일부 입금",
  paid: "완납",
};

export interface EntryFee {
  teamId: string;
  amount: number;
  status: EntryFeeStatus;
  paidAt: string | null;
  memo: string;
}

/** 얼리버드 마감 — 이 시각까지 신청한 팀은 얼리버드 금액이 적용된다. */
export const EARLY_BIRD_DEADLINE_ISO = "2026-09-07T23:59:59+09:00";

export const EARLY_BIRD_AMOUNT = Number(MIXED_FUTSAL_ENTRY_FEE_EARLY_AMOUNT);
export const REGULAR_AMOUNT = Number(MIXED_FUTSAL_ENTRY_FEE_REGULAR_AMOUNT);

/**
 * 신청 시점 기준 적용 금액.
 *
 * 운영진이 매번 40/45를 직접 판단하면 실수가 난다. 팀이 만들어진 시각으로
 * 자동 산출하되, 화면에서 수정할 수 있게 둔다(예외 합의, 할인).
 */
export function defaultFeeFor(createdAt: number): number {
  return createdAt <= Date.parse(EARLY_BIRD_DEADLINE_ISO)
    ? EARLY_BIRD_AMOUNT
    : REGULAR_AMOUNT;
}

export interface FeeSummary {
  teamCount: number;
  expected: number;
  collected: number;
  outstanding: number;
  paidCount: number;
  unpaidCount: number;
}

/**
 * 수납 요약.
 *
 * collected 는 status 가 아니라 amount 를 기준으로 세지 않는다 —
 * amount 는 '청구 금액'이고, 실제로 들어온 돈은 완납 여부로만 판단한다.
 * 일부 입금은 금액이 확정되지 않아 미수금 쪽에 남긴다(낙관적 집계 금지).
 */
export function summarizeFees(fees: EntryFee[]): FeeSummary {
  const expected = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const collected = fees
    .filter((f) => f.status === "paid")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  return {
    teamCount: fees.length,
    expected,
    collected,
    outstanding: expected - collected,
    paidCount: fees.filter((f) => f.status === "paid").length,
    unpaidCount: fees.filter((f) => f.status !== "paid").length,
  };
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
