"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { ActivityItem } from "@/components/activity-item";
import type { ActivityEvent } from "@/types";

const PAGE_SIZE = 30;

export default function FeedPage() {
  const fetchFeed = useDataStore((s) => s.fetchActivityFeed);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 최초 로드.
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
    void fetchFeed({ limit: PAGE_SIZE }).then((list) => {
      if (!active) return;
      setItems(list);
      setLoading(false);
      if (list.length < PAGE_SIZE) setDone(true);
    });
    return () => {
      active = false;
    };
  }, [fetchFeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore || done || items.length === 0) return;
    setLoadingMore(true);
    const cursor = items[items.length - 1].createdAt;
    const next = await fetchFeed({ cursor, limit: PAGE_SIZE });
    setItems((prev) => [...prev, ...next]);
    if (next.length < PAGE_SIZE) setDone(true);
    setLoadingMore(false);
  }, [fetchFeed, items, loadingMore, done]);

  // IntersectionObserver 기반 무한 스크롤. sentinel 노출 시 다음 페이지 요청.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void loadMore();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div
      className="pt-[60px] min-h-screen"
      style={{ background: "var(--color-fg-paper-2)" }}
    >
      {/* Header */}
      <header
        className="px-5 md:px-10 pt-12 pb-8"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="max-w-3xl mx-auto">
          <p className="fg-label mb-3" style={{ color: "var(--primary)" }}>
            FEED
          </p>
          <h1
            className="font-black leading-none fg-display"
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              letterSpacing: "-1.5px",
              color: "var(--color-fg-ink)",
            }}
          >
            최근 활동
          </h1>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--color-fg-ink-muted)" }}
          >
            FairGround에서 일어나는 일들
          </p>
        </div>
      </header>

      {/* List */}
      <main className="px-5 md:px-10 py-10">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div
              className="py-16 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              불러오는 중…
            </div>
          ) : items.length === 0 ? (
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
                아직 활동이 없어요
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                첫 글을 올려보세요.
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {items.map((ev) => (
                  <ActivityItem key={ev.id} event={ev} />
                ))}
              </ul>
              {/* infinite-scroll sentinel */}
              <div
                ref={sentinelRef}
                className="py-6 text-center text-xs"
                style={{ color: "var(--color-fg-ink-ghost)" }}
                aria-live="polite"
              >
                {loadingMore
                  ? "더 불러오는 중…"
                  : done
                    ? "모두 표시되었습니다"
                    : ""}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
