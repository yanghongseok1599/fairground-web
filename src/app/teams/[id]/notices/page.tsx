"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Pin, AlertCircle, Plus, X } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { canManageTeamMembers } from "@/lib/team-permissions";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { NoticeForm } from "@/components/notice-form";
import { MentionRenderer } from "@/components/mention-renderer";
import { AuthorRoleBadge } from "@/components/author-role-badge";
import { NOTICE_CATEGORIES, type Notice, type Team } from "@/types";
import { formatDate } from "@/utils/formatters";

const FILTERS = ["전체", ...NOTICE_CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

/**
 * 팀 공지 라우트.
 *
 * 읽기: 누구나 가능 (RLS: select using(true))
 * 쓰기/수정/삭제: team_id 가 본 팀인 경우 is_team_manager(team_id) (매니저/감독)
 * UI는 매니저/감독 본인 팀 또는 admin 에게 작성 CTA 노출.
 * 최종 강제는 RLS — 클라 가드 통과해도 RLS 에서 차단됨.
 */
export default function TeamNoticesPage() {
  const { id: teamId } = useParams<{ id: string }>();
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const fetchNotices = useDataStore((s) => s.fetchNotices);
  const createNotice = useDataStore((s) => s.createNotice);
  const { user, player } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [filter, setFilter] = useState<Filter>("전체");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [t, list] = await Promise.all([fetchTeam(teamId), fetchNotices({ teamId })]);
    setTeam(t);
    setNotices(list);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const filtered = useMemo(() => {
    if (filter === "전체") return notices;
    return notices.filter((n) => n.category === filter);
  }, [notices, filter]);

  // 클라 UX 가드 — lib/team-permissions로 통일 (admin OR 본인 팀의
  // 매니저/감독. 최종 강제는 RLS(is_team_manager).
  const canWrite = useMemo(
    () => canManageTeamMembers(player, team),
    [player, team],
  );

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      {/* Header */}
      <header className="px-5 md:px-10 pt-10 pb-7" style={{ background: "var(--color-fg-paper)" }}>
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-1 text-sm font-medium mb-5"
            style={{ color: "var(--primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> 팀 홈
          </Link>
          <p className="fg-label mb-3" style={{ color: "var(--primary)" }}>
            TEAM NOTICES
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-black leading-none"
                style={{
                  fontSize: "clamp(28px, 5vw, 44px)",
                  letterSpacing: "-1.2px",
                  color: "var(--color-fg-ink)",
                }}
              >
                {team?.name ? `${team.name} 공지` : "팀 공지"}
              </h1>
              <p className="mt-3 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                팀 내부 공지를 확인하세요. 일반 공지는{" "}
                <Link href="/notices" className="underline" style={{ color: "var(--primary)" }}>
                  /notices
                </Link>
                에서 볼 수 있습니다.
              </p>
            </div>
            {canWrite && !showForm && (
              <Button
                className="min-h-[44px]"
                style={{ background: "var(--primary)", color: "#fff" }}
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-4 h-4" />
                공지 작성
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div
        className="px-5 md:px-10 py-5"
        style={{
          background: "var(--color-fg-paper)",
          borderTop: "1px solid var(--color-fg-line-soft)",
        }}
      >
        <div
          className="max-w-4xl mx-auto flex gap-2 flex-wrap"
          role="radiogroup"
          aria-label="카테고리 필터"
        >
          {FILTERS.map((f) => (
            <CategoryChip
              key={f}
              label={f}
              active={filter === f}
              onClick={() => setFilter(f)}
              role="radio"
              ariaPressed={filter === f}
            />
          ))}
        </div>
      </div>

      {/* Write form (inline) */}
      {showForm && canWrite && user && (
        <section className="px-5 md:px-10 py-6">
          <div
            className="max-w-4xl mx-auto rounded-2xl px-5 md:px-8 py-6 md:py-8"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="font-bold text-base flex items-center gap-2"
                style={{ color: "var(--color-fg-ink)" }}
              >
                <ClipboardList className="w-4 h-4" /> 새 팀 공지
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="작성 취소"
                className="p-2 rounded-md transition-colors hover:bg-[#F5F7FF]"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <NoticeForm
              submitLabel="발행"
              cancelHref={`/teams/${teamId}/notices`}
              onSubmit={async (values) => {
                await createNotice({
                  title: values.title,
                  body: values.body,
                  category: values.category,
                  isPinned: values.isPinned,
                  isImportant: values.isImportant,
                  authorId: user.uid,
                  teamId,
                });
                setShowForm(false);
                await reload();
              }}
            />
          </div>
        </section>
      )}

      {/* List */}
      <main className="px-5 md:px-10 py-10">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div
              className="py-16 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              불러오는 중…
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="py-16 text-center rounded-xl"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--color-fg-ink)" }}
              >
                등록된 팀 공지가 없습니다
              </p>
              <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                {canWrite
                  ? "위의 ‘공지 작성’ 버튼으로 첫 공지를 작성해보세요."
                  : "팀 운영진이 공지를 게시하면 이곳에 표시됩니다."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((n) => (
                <li key={n.id}>
                  <article
                    className="rounded-xl px-5 py-4"
                    style={{
                      background: "var(--color-fg-paper)",
                      border: "1px solid var(--color-fg-line-soft)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {n.isPinned && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: "var(--primary)", color: "#fff" }}
                        >
                          <Pin className="w-3 h-3" /> 고정
                        </span>
                      )}
                      {n.isImportant && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: "var(--color-fg-red)", color: "#fff" }}
                        >
                          <AlertCircle className="w-3 h-3" /> 중요
                        </span>
                      )}
                      <CategoryChip label={n.category} />
                    </div>
                    <h2
                      className="font-bold text-base md:text-lg leading-snug"
                      style={{ color: "var(--color-fg-ink)" }}
                    >
                      {n.title}
                    </h2>
                    <div
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "var(--color-fg-ink)" }}
                    >
                      <MentionRenderer body={n.body} />
                    </div>
                    <div
                      className="mt-3 flex items-center gap-3 text-xs"
                      style={{ color: "var(--color-fg-ink-muted)" }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {n.authorName ?? "운영"}
                        <AuthorRoleBadge role={n.authorRole} />
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={new Date(n.publishedAt).toISOString()}>
                        {formatDate(n.publishedAt)}
                      </time>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
