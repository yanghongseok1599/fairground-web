"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Megaphone, Users, User, Search as SearchIcon } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import type { SearchResults } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY: SearchResults = { posts: [], notices: [], teams: [], players: [] };

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function totalHits(r: SearchResults): number {
  return r.posts.length + r.notices.length + r.teams.length + r.players.length;
}

export function SearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQ("");
      setResults(EMPTY);
      setLoading(false);
    }
  }, [open]);

  // Autofocus when opened
  useEffect(() => {
    if (open) {
      // wait a tick for the input to mount
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced search (300ms) with cancellation guard
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 1) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const r = await useDataStore.getState().searchAll(query);
        if (!cancelled) {
          setResults(r);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setResults(EMPTY);
          setLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q, open]);

  if (!open) return null;

  const trimmed = q.trim();
  const hasQuery = trimmed.length >= 1;
  const count = totalHits(results);
  const noResults = hasQuery && !loading && count === 0;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="통합 검색"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="검색 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(13, 27, 42, 0.45)", backdropFilter: "blur(2px)" }}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-[640px] rounded-md border shadow-xl"
        style={{
          background: "var(--color-fg-paper, #FFFFFF)",
          borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input header (sticky) */}
        <div
          className="sticky top-0 flex items-center gap-3 border-b px-4 py-3"
          style={{
            borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))",
            background: "var(--color-fg-paper, #FFFFFF)",
            borderTopLeftRadius: "var(--radius, 6px)",
            borderTopRightRadius: "var(--radius, 6px)",
          }}
        >
          <SearchIcon
            width={18}
            height={18}
            style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="글, 공지, 팀, 선수 검색"
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-fg-ink, #0D1B2A)" }}
            aria-label="검색어"
          />
          <kbd
            className="hidden md:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px]"
            style={{
              borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))",
              color: "var(--color-fg-ink-muted, #6B7280)",
            }}
            aria-hidden="true"
          >
            ESC
          </kbd>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto">
          {!hasQuery && (
            <div
              className="px-6 py-10 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
            >
              <div>검색어를 입력하세요</div>
              <div className="mt-2 text-[11px]">
                단축키 <kbd className="rounded border px-1 py-0.5" style={{ borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))" }}>⌘K</kbd>{" "}
                또는{" "}
                <kbd className="rounded border px-1 py-0.5" style={{ borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))" }}>Ctrl K</kbd>
              </div>
            </div>
          )}

          {hasQuery && loading && (
            <div
              className="px-6 py-10 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
            >
              검색 중...
            </div>
          )}

          {noResults && (
            <div
              className="px-6 py-10 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
            >
              검색 결과가 없습니다
            </div>
          )}

          {hasQuery && !loading && count > 0 && (
            <div className="py-1">
              {/* Posts */}
              {results.posts.length > 0 && (
                <Section title="글" icon={<MessageSquare width={14} height={14} />}>
                  {results.posts.map((p) => (
                    <button
                      key={`post-${p.id}`}
                      type="button"
                      onClick={() => go(`/board/${p.id}`)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    >
                      <MessageSquare
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-semibold"
                          style={{ color: "var(--color-fg-ink, #0D1B2A)" }}
                        >
                          {p.title}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
                        >
                          {p.authorName ? `${p.authorName} · ` : ""}
                          {relTime(p.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {/* Notices */}
              {results.notices.length > 0 && (
                <Section title="공지" icon={<Megaphone width={14} height={14} />}>
                  {results.notices.map((n) => (
                    <button
                      key={`notice-${n.id}`}
                      type="button"
                      onClick={() => go(`/notices/${n.id}`)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    >
                      <Megaphone
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--color-fg-ink, #0D1B2A)" }}
                          >
                            {n.title}
                          </div>
                          {n.isImportant && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: "var(--destructive, #DC2626)",
                                color: "#fff",
                              }}
                            >
                              중요
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
                        >
                          {relTime(n.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {/* Teams */}
              {results.teams.length > 0 && (
                <Section title="팀" icon={<Users width={14} height={14} />}>
                  {results.teams.map((t) => (
                    <button
                      key={`team-${t.id}`}
                      type="button"
                      onClick={() => go(`/teams/${t.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    >
                      {t.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded object-cover"
                          style={{
                            border: "1px solid var(--color-fg-line-soft, rgba(13,27,42,0.12))",
                          }}
                        />
                      ) : (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                          style={{
                            background: "var(--color-fg-paper-3, #EEF3FF)",
                            color: "var(--color-fg-ink-muted, #6B7280)",
                          }}
                        >
                          <Users width={14} height={14} />
                        </div>
                      )}
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--color-fg-ink, #0D1B2A)" }}
                      >
                        {t.name}
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {/* Players */}
              {results.players.length > 0 && (
                <Section title="선수" icon={<User width={14} height={14} />}>
                  {results.players.map((p) => (
                    <button
                      key={`player-${p.id}`}
                      type="button"
                      onClick={() => go(`/players/${p.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    >
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photoUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                          style={{
                            border: "1px solid var(--color-fg-line-soft, rgba(13,27,42,0.12))",
                          }}
                        />
                      ) : (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: "var(--color-fg-paper-3, #EEF3FF)",
                            color: "var(--color-fg-ink-muted, #6B7280)",
                          }}
                        >
                          <User width={14} height={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-semibold"
                          style={{ color: "var(--color-fg-ink, #0D1B2A)" }}
                        >
                          {p.name}
                          {typeof p.number === "number" && (
                            <span
                              className="ml-2 text-[11px] font-normal"
                              style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
                            >
                              #{p.number}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div
        className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-fg-ink-muted, #6B7280)" }}
      >
        <span aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
