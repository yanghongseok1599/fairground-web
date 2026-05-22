"use client";

import { useState, useEffect, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import type { ReportReason, ReportTarget } from "@/types";

const REPORT_BODY_MAX = 2000;

const REASON_OPTIONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: "spam", label: "스팸 / 광고", hint: "반복 게시, 광고, 도배" },
  { value: "abuse", label: "비방 / 욕설", hint: "혐오, 인신공격, 차별 표현" },
  { value: "sexual", label: "음란물", hint: "노골적 성적 표현" },
  { value: "illegal", label: "불법 정보", hint: "도박·마약·불법 거래" },
  { value: "other", label: "기타", hint: "위 항목에 해당하지 않는 사유" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  targetTitle?: string;
}

/**
 * 신고 모달.
 *
 * - 비로그인 사용자: 안내만 노출, 신고 차단.
 * - 사유 라디오 5종(필수) + 추가 설명(선택, 최대 2000자).
 * - 중복 신고는 store에서 `이미 신고하신 내용입니다` 로 throw — 그대로 노출.
 * - 성공 시 onClose() 호출. 토스트 라이브러리 없음 → window.alert 폴백.
 */
export function ReportDialog({ open, onClose, targetType, targetId, targetTitle }: Props) {
  const { user } = useAuth();
  const createReport = useDataStore((s) => s.createReport);

  const [reason, setReason] = useState<ReportReason>("spam");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // open 토글 시 상태 초기화 — 직전 신고의 잔상 방지.
  useEffect(() => {
    if (open) {
      setReason("spam");
      setBody("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!user) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = body.trim();
      await createReport(targetType, targetId, reason, trimmed || undefined);
      if (typeof window !== "undefined") {
        window.alert("신고가 접수되었습니다. 검토 후 처리됩니다.");
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "신고 처리 중 오류가 발생했습니다";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" style={{ color: "var(--color-fg-red)" }} aria-hidden="true" />
            신고하기
          </DialogTitle>
          <DialogDescription>
            {targetTitle
              ? `“${targetTitle}” 에 대해 운영진에 신고합니다.`
              : "이 콘텐츠를 운영진에 신고합니다."}
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <>
            <p className="text-sm py-2" style={{ color: "var(--color-fg-ink-muted)" }}>
              신고는 로그인 후 이용할 수 있습니다.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                닫기
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2" disabled={submitting}>
              <legend className="text-sm font-semibold mb-1" style={{ color: "var(--color-fg-ink)" }}>
                사유 선택
              </legend>
              {REASON_OPTIONS.map((opt) => {
                const id = `report-reason-${opt.value}`;
                const selected = reason === opt.value;
                return (
                  <label
                    key={opt.value}
                    htmlFor={id}
                    className="flex items-start gap-3 cursor-pointer rounded-md px-3 py-2 transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    style={{
                      border: `1px solid ${selected ? "var(--primary)" : "var(--color-fg-line-soft)"}`,
                      background: selected ? "var(--color-fg-paper-3, #EEF3FF)" : "transparent",
                    }}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="report-reason"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setReason(opt.value)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium" style={{ color: "var(--color-fg-ink)" }}>
                        {opt.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                        {opt.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="flex flex-col gap-1">
              <label htmlFor="report-body" className="text-sm font-semibold" style={{ color: "var(--color-fg-ink)" }}>
                추가 설명 <span style={{ color: "var(--color-fg-ink-muted)" }}>(선택)</span>
              </label>
              <textarea
                id="report-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, REPORT_BODY_MAX))}
                maxLength={REPORT_BODY_MAX}
                rows={3}
                placeholder="구체적인 상황이나 맥락을 알려주시면 검토에 도움이 됩니다"
                disabled={submitting}
                className="px-3 py-2 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y w-full"
                style={{
                  border: "1px solid var(--color-fg-line-soft)",
                  background: "var(--color-fg-paper)",
                  color: "var(--color-fg-ink)",
                }}
              />
              <p className="text-[11px] text-right" style={{ color: "var(--color-fg-ink-muted)" }}>
                {body.length} / {REPORT_BODY_MAX}
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm font-medium px-3 py-2 rounded-md"
                style={{
                  color: "var(--color-fg-red)",
                  background: "rgba(255,107,107,0.08)",
                  border: "1px solid rgba(255,107,107,0.24)",
                }}
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                style={{ background: "var(--color-fg-red)", color: "#fff" }}
              >
                {submitting ? "전송 중…" : "신고"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
