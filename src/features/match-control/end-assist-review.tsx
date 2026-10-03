"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reviewing an unassisted goal never creates a fictional assist event. */
export function EndAssistReview({ matchId, goalIds, goalCount, assistCount, disabled }: {
  matchId: string;
  goalIds: string[];
  goalCount: number;
  assistCount: number;
  disabled: boolean;
}) {
  const [review, setReview] = useState<{ matchId: string; goalIds: string[] } | null>(null);
  if (goalIds.length === 0) return null;
  const confirmed = review?.matchId === matchId && goalIds.every((id) => review.goalIds.includes(id));

  return <div role="status" className={`space-y-2 rounded-lg border p-3 text-sm ${confirmed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
    <p className="flex items-start gap-2">
      {!confirmed && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{confirmed
        ? "어시스트 없는 골로 확인했습니다. 어시스트를 추가하지 않고 종료합니다."
        : <>골 {goalCount}개, 어시스트 {assistCount}개입니다. 어시스트가 없는 골은 그대로 종료할 수 있습니다. 어시스트 누락이 있으면 종료 전에 관리자 기록을 확인하세요.</>}</span>
    </p>
    {!confirmed && <Button type="button" variant="outline" className="min-h-11 bg-white" disabled={disabled}
      onClick={() => setReview({ matchId, goalIds: [...goalIds] })}>어시스트 없음 확인</Button>}
  </div>;
}
