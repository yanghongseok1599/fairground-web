"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pin, AlertCircle, Plus } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { AuthorRoleBadge } from "@/components/author-role-badge";
import { PUBLIC_PAGE_CONTENT_CLASS, PUBLIC_PAGE_GUTTER_CLASS } from "@/lib/page-layout";
import { NOTICE_CATEGORIES, type Notice } from "@/types";
import { formatDate } from "@/utils/formatters";

const FILTERS = ["전체", ...NOTICE_CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

function canWriteNotice(role: string | undefined): boolean {
  return role === "admin" || role === "referee";
}

export default function NoticesPage() {
  const fetchNotices = useDataStore((s) => s.fetchNotices);
  const { player } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [filter, setFilter] = useState<Filter>("전체");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    void fetchNotices().then((list) => {
      if (active) {
        setNotices(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchNotices]);

  const filtered = useMemo(() => {
    if (filter === "전체") return notices;
    return notices.filter((n) => n.category === filter);
  }, [notices, filter]);

  const canWrite = canWriteNotice(player?.role);

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      {/* Header */}
      <header className={`${PUBLIC_PAGE_GUTTER_CLASS} pt-12 pb-8`} style={{ background: "var(--color-fg-paper)" }}>
        <div className={PUBLIC_PAGE_CONTENT_CLASS}>
          <p className="fg-label mb-3" style={{ color: "var(--primary)" }}>
            NOTICES
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-black leading-none"
                style={{
                  fontSize: "clamp(32px, 5vw, 48px)",
                  letterSpacing: "-1.5px",
                  color: "var(--color-fg-ink)",
                }}
              >
                공지사항
              </h1>
              <p
                className="mt-3 text-sm"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                운영진의 공식 공지를 확인하세요
              </p>
            </div>
            {canWrite && (
              <Link href="/notices/new">
                <Button className="min-h-[44px]" style={{ background: "var(--primary)", color: "#fff" }}>
                  <Plus className="w-4 h-4" />
                  공지 작성
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div className={`${PUBLIC_PAGE_GUTTER_CLASS} py-5`} style={{ background: "var(--color-fg-paper)", borderTop: "1px solid var(--color-fg-line-soft)" }}>
        <div
          className={`${PUBLIC_PAGE_CONTENT_CLASS} flex gap-2 flex-wrap`}
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

      {/* List */}
      <main className={`${PUBLIC_PAGE_GUTTER_CLASS} py-10`}>
        <div className={PUBLIC_PAGE_CONTENT_CLASS}>
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
                등록된 공지가 없습니다
              </p>
              <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                운영진이 공지를 게시하면 이곳에 표시됩니다.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/notices/${n.id}`}
                    className="block rounded-xl px-5 py-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      background: "var(--color-fg-paper)",
                      border: "1px solid var(--color-fg-line-soft)",
                      boxShadow: "var(--shadow-sm)",
                      ['--tw-ring-color' as string]: "var(--primary)",
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
                      className="mt-2 flex items-center gap-3 text-xs"
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
