"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Flag,
  XCircle,
} from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { useDataStore } from "@/stores/dataStore";
import { formatDate } from "@/utils/formatters";
import type { Report, ReportReason, ReportTarget } from "@/types";

/**
 * 신고 큐 (admin 전용).
 *
 * - RLS가 admin/본인 외 select 차단 → 일반 사용자는 빈 목록을 받음.
 *   본 페이지는 AdminGuard로 진입 자체를 차단해 UX 친절화.
 * - 액션:
 *   · 기각  → resolveReport(id, 'dismiss')
 *   · 숨김 처리 → hideTarget(true) + resolveReport(id, 'resolve')
 *   · 대상 보기 → target_type에 맞는 라우트로 이동
 * - "숨김 해제"는 큐에 들어오는 단계가 아니라 별도 화면에서 다룰 작업이라 본 페이지에선 제외.
 */
export default function AdminReportsPage() {
  return (
    <AdminGuard allow={["admin"]}>
      <AdminReports />
    </AdminGuard>
  );
}

const REASON_LABEL: Record<ReportReason, string> = {
  spam: "스팸/광고",
  abuse: "비방/욕설",
  sexual: "음란물",
  illegal: "불법",
  other: "기타",
};

const TARGET_LABEL: Record<ReportTarget, string> = {
  post: "게시글",
  comment: "댓글",
  photo: "사진",
};

function targetHref(targetType: ReportTarget, targetId: string): string | null {
  // 댓글은 post detail의 #cm-{id} 해시로 점프하고 싶지만 신고 row에 post_id가 없어 직접 못 풂.
  // → 댓글은 게시판 루트로 fallback. 사진은 팀 컨텍스트 없이는 매핑 어려워 null.
  switch (targetType) {
    case "post":
      return `/board/${targetId}`;
    case "comment":
      return `/board`;
    case "photo":
      return null;
    default:
      return null;
  }
}

function AdminReports() {
  const fetchPendingReports = useDataStore((s) => s.fetchPendingReports);
  const resolveReport = useDataStore((s) => s.resolveReport);
  const hideTarget = useDataStore((s) => s.hideTarget);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPendingReports();
      setReports(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "신고 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDismiss(report: Report) {
    if (!confirm("이 신고를 기각하시겠습니까? 대상 콘텐츠는 그대로 유지됩니다.")) return;
    setActingId(report.id);
    try {
      await resolveReport(report.id, "dismiss");
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "기각 실패");
    } finally {
      setActingId("");
    }
  }

  async function handleHide(report: Report) {
    if (
      !confirm(
        `대상 ${TARGET_LABEL[report.targetType]}을(를) 숨김 처리하고 신고를 종결하시겠습니까?`
      )
    )
      return;
    setActingId(report.id);
    try {
      await hideTarget(report.targetType, report.targetId, true);
      await resolveReport(report.id, "resolve");
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "숨김 처리 실패");
    } finally {
      setActingId("");
    }
  }

  return (
    <AdminShell
      eyebrow="REPORTS QUEUE"
      title="신고 관리"
      description="사용자가 접수한 콘텐츠 신고를 검토하고, 기각하거나 대상 콘텐츠를 숨김 처리합니다. 같은 대상에 대한 중복 신고는 자동으로 차단됩니다."
    >
      <AdminPanel>
        <div
          className="border-b px-5 py-4 flex items-center justify-between gap-3"
          style={{ borderColor: "rgba(0,71,171,0.14)" }}
        >
          <div className="fg-label" style={{ color: "var(--primary)" }}>
            PENDING REPORTS · {reports.length}
          </div>
          <Flag className="h-5 w-5" style={{ color: "var(--primary)" }} />
        </div>

        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
            로딩 중…
          </div>
        ) : error ? (
          <div className="p-12 text-center" style={{ color: "var(--destructive)" }}>
            {error}
          </div>
        ) : reports.length === 0 ? (
          <div className="p-16 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>
            대기 중인 신고가 없습니다
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
            {reports.map((report) => {
              const href = targetHref(report.targetType, report.targetId);
              const acting = actingId === report.id;
              return (
                <article key={report.id} className="p-5 transition-colors hover:bg-[#F5F7FF]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                        <AdminStatusPill tone="red">{TARGET_LABEL[report.targetType]}</AdminStatusPill>
                        <span style={{ color: "var(--color-fg-ink)", fontWeight: 600 }}>
                          {report.reporterName ?? "익명"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={new Date(report.createdAt).toISOString()}>
                          {formatDate(report.createdAt)}
                        </time>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            background: "rgba(255,107,107,0.10)",
                            color: "var(--color-fg-red)",
                            border: "1px solid rgba(255,107,107,0.24)",
                          }}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {REASON_LABEL[report.reason]}
                        </span>
                        <span className="text-[11px] font-mono" style={{ color: "var(--color-fg-ink-muted)" }}>
                          ID: {report.targetId.slice(0, 8)}…
                        </span>
                      </div>

                      {report.body && (
                        <p
                          className="text-sm whitespace-pre-wrap rounded-md px-3 py-2 max-w-2xl"
                          style={{
                            background: "var(--color-fg-paper-2)",
                            color: "var(--color-fg-ink)",
                            border: "1px solid var(--color-fg-line-soft)",
                          }}
                        >
                          {report.body}
                        </p>
                      )}

                      {href ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 text-xs font-semibold"
                          style={{ color: "var(--primary)" }}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          대상 보기
                        </Link>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                          대상 보기 미지원 ({TARGET_LABEL[report.targetType]})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleDismiss(report)}
                        disabled={acting}
                        className="inline-flex min-h-[40px] items-center gap-1.5 px-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                        style={{
                          background: "var(--color-fg-paper)",
                          color: "var(--color-fg-ink)",
                          border: "1px solid var(--color-fg-line-soft)",
                        }}
                      >
                        <XCircle className="w-4 h-4" />
                        기각
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleHide(report)}
                        disabled={acting}
                        className="inline-flex min-h-[40px] items-center gap-1.5 px-3 text-sm font-bold transition-opacity disabled:opacity-60"
                        style={{ background: "var(--color-fg-red)", color: "#fff" }}
                      >
                        <EyeOff className="w-4 h-4" />
                        {acting ? "처리 중…" : "숨김 처리"}
                      </button>
                      <span className="sr-only">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}
