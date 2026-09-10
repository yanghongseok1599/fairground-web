"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Loader2, Lock, Plus, X,
  Target, Trophy, Sparkles, Crown, Star, Medal, Shield, Award,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import type { BadgeMaster, PlayerBadgeRow } from "@/types";

/* ===========================================================
 * Light theme (White&Blue) — FairGround BrandKit 2026
 * 배지 인벤토리 + 4슬롯 장착 UI. profiles.badges (최대 4개) 동기화.
 * =========================================================== */

const MAX_EQUIPPED = 4;

// 서버 icon 키워드 → lucide-react 컴포넌트 매핑.
// 알 수 없는 값은 Award fallback (디자인 일관성 유지).
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  goal: Target,
  trophy: Trophy,
  assist: Sparkles,
  crown: Crown,
  star: Star,
  medal: Medal,
  shield: Shield,
};

function IconFor({ icon, className }: { icon: string | null; className?: string }) {
  const Cmp = (icon && ICON_MAP[icon]) || Award;
  return <Cmp className={className} />;
}

// 카테고리 → 한글 라벨 (UI 그룹핑용).
const CATEGORY_LABELS: Record<string, string> = {
  goals: "골",
  assists: "어시스트",
  mom: "MOM",
  games: "경기 출전",
};

const CATEGORY_ORDER = ["goals", "assists", "mom", "games"];

function labelStyleMono(): React.CSSProperties {
  return {
    color: "var(--color-fg-ink-muted)",
    fontFamily: "var(--font-space-mono)",
  };
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p
      className="text-[10px] uppercase tracking-[3px] mb-4"
      style={{ fontFamily: "var(--font-space-mono)", color: "var(--primary)" }}
    >
      {text}
    </p>
  );
}

export default function MyBadgesPage() {
  const router = useRouter();
  const { player, initialized, updatePlayer } = useAuth();
  const store = useDataStore();

  const [allBadges, setAllBadges] = useState<BadgeMaster[]>([]);
  const [myBadges, setMyBadges] = useState<PlayerBadgeRow[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);

  // 초기 로딩: 마스터 + 본인 진행도.
  useEffect(() => {
    if (!initialized) return;
    if (!player) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [masters, mine] = await Promise.all([
          store.fetchAllBadges(),
          store.fetchMyBadges(player.id),
        ]);
        if (cancelled) return;
        setAllBadges(masters);
        setMyBadges(mine);
        setEquipped((player.badges ?? []).slice(0, MAX_EQUIPPED));
      } catch {
        if (!cancelled) setLoadError("배지를 불러오지 못했습니다. 기존 장착 상태는 변경되지 않았습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, player?.id, loadRevision]);

  // 빠른 검색용 인덱스.
  const masterById = useMemo(() => {
    const m = new Map<string, BadgeMaster>();
    allBadges.forEach((b) => m.set(b.id, b));
    return m;
  }, [allBadges]);

  const progressById = useMemo(() => {
    const m = new Map<string, PlayerBadgeRow>();
    myBadges.forEach((r) => m.set(r.badgeId, r));
    return m;
  }, [myBadges]);

  const earnedBadges = useMemo(
    () => allBadges.filter((b) => progressById.get(b.id)?.isEarned),
    [allBadges, progressById],
  );

  const lockedBadges = useMemo(
    () => allBadges.filter((b) => !progressById.get(b.id)?.isEarned),
    [allBadges, progressById],
  );

  // 카테고리별 그룹핑 (UI 섹션용).
  const groupByCategory = (list: BadgeMaster[]) => {
    const groups: Record<string, BadgeMaster[]> = {};
    list.forEach((b) => {
      const key = b.category || "기타";
      (groups[key] ||= []).push(b);
    });
    // 카테고리 정렬: CATEGORY_ORDER → 그 외 알파벳.
    return CATEGORY_ORDER
      .filter((k) => groups[k])
      .map((k) => ({ key: k, items: groups[k] }))
      .concat(
        Object.keys(groups)
          .filter((k) => !CATEGORY_ORDER.includes(k))
          .sort()
          .map((k) => ({ key: k, items: groups[k] })),
      );
  };

  // 장착/해제 토글. 획득 배지만 장착 가능.
  const toggleEquip = async (badgeId: string) => {
    if (!player || saving) return;
    const row = progressById.get(badgeId);
    if (!row?.isEarned) {
      setMessage("아직 획득하지 않은 배지입니다.");
      return;
    }

    let next: string[];
    if (equipped.includes(badgeId)) {
      // 해제.
      next = equipped.filter((id) => id !== badgeId);
    } else {
      // 장착 (4슬롯 가득 차면 거부).
      if (equipped.length >= MAX_EQUIPPED) {
        setMessage(`장착 슬롯이 가득 찼습니다 (최대 ${MAX_EQUIPPED}개).`);
        return;
      }
      next = [...equipped, badgeId];
    }

    setSaving(true);
    setMessage("");
    const prev = equipped;
    setEquipped(next); // 옵티미스틱.
    try {
      await store.updateEquippedBadges(player.id, next);
      // authStore.player.badges 동기화 (RLS 통과 후).
      await updatePlayer({ badges: next });
    } catch (e) {
      // 롤백.
      setEquipped(prev);
      setMessage(e instanceof Error ? e.message : "장착 저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ===== 렌더링 가드 =====
  if (!initialized || loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--primary)" }} />
          <p className="text-sm" style={labelStyleMono()}>배지 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div
        className="min-h-screen pt-[80px] px-6"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="max-w-md mx-auto text-center mt-20">
          <p className="text-sm mb-4" style={{ color: "var(--color-fg-ink-muted)" }}>
            선수 등록 후 배지를 확인할 수 있습니다.
          </p>
          <Link
            href="/my/player-setup"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--color-fg-paper)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            선수 카드 만들기
          </Link>
        </div>
      </div>
    );
  }

  if (loadError) {
    return <div className="min-h-screen px-6 pt-[100px] text-center">
      <p role="alert">{loadError}</p>
      <button type="button" className="mt-4 rounded-xl border px-4 py-2" onClick={() => setLoadRevision((value) => value + 1)}>배지 다시 불러오기</button>
    </div>;
  }

  const totalEarned = earnedBadges.length;
  const totalAll = allBadges.length;

  return (
    <div className="min-h-screen pt-[60px] pb-16" style={{ background: "var(--color-fg-paper)" }}>
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 pt-6 pb-6"
        style={{ background: "var(--color-fg-paper-2)" }}
      >
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로 가기"
            className="inline-flex items-center gap-1.5 mb-4 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
          >
            <ChevronLeft className="h-4 w-4" /> 마이페이지
          </button>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1
                className="font-black text-[26px] leading-none mb-2"
                style={{
                  fontFamily: "var(--font-pretendard)",
                  letterSpacing: "-1.2px",
                  color: "var(--color-fg-ink)",
                }}
              >
                내 배지
              </h1>
              <p className="text-xs" style={labelStyleMono()}>
                획득 {totalEarned} / {totalAll} · 장착 {equipped.length} / {MAX_EQUIPPED}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 장착 슬롯 (4개) ── */}
      <div className="px-6 max-w-3xl mx-auto mt-8">
        <SectionLabel text="Equipped — 카드 표시" />
        <div
          className="rounded-2xl px-5 py-5"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: MAX_EQUIPPED }).map((_, slotIdx) => {
              const badgeId = equipped[slotIdx];
              const badge = badgeId ? masterById.get(badgeId) : undefined;
              if (!badge) {
                return (
                  <div
                    key={`slot-${slotIdx}`}
                    className="aspect-square rounded-2xl flex flex-col items-center justify-center"
                    style={{
                      background: "var(--color-fg-paper-3)",
                      border: "2px dashed var(--color-fg-line-soft)",
                      color: "var(--color-fg-ink-muted)",
                    }}
                    aria-label={`빈 슬롯 ${slotIdx + 1}`}
                  >
                    <Plus className="w-6 h-6 mb-1 opacity-60" />
                    <span className="text-[10px]" style={labelStyleMono()}>
                      슬롯 {slotIdx + 1}
                    </span>
                  </div>
                );
              }
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => toggleEquip(badge.id)}
                  disabled={saving}
                  aria-label={`${badge.name} 장착 해제`}
                  className="group relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                  style={{
                    background: "var(--primary)",
                    color: "var(--color-fg-paper)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <IconFor icon={badge.icon} className="w-7 h-7" />
                  <span
                    className="text-[10px] font-bold text-center px-1 line-clamp-2"
                    style={{ fontFamily: "var(--font-pretendard)" }}
                  >
                    {badge.name}
                  </span>
                  <span
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                    aria-hidden="true"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
          {message && (
            <p
              className="mt-3 text-xs"
              role="status"
              aria-live="polite"
              style={{ color: message.includes("실패") || message.includes("가득") || message.includes("않은") ? "var(--destructive)" : "var(--primary)" }}
            >
              {message}
            </p>
          )}
          <p className="mt-3 text-[11px]" style={labelStyleMono()}>
            선수 카드에 표시할 배지를 최대 {MAX_EQUIPPED}개까지 선택할 수 있습니다.
          </p>
        </div>
      </div>

      {/* ── 획득한 배지 ── */}
      <div className="px-6 max-w-3xl mx-auto mt-10">
        <SectionLabel text="Earned — 획득한 배지" />
        {earnedBadges.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-10 text-center"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px dashed var(--color-fg-line-soft)",
            }}
          >
            <p className="text-sm mb-1" style={{ color: "var(--color-fg-ink)" }}>
              아직 획득한 배지가 없습니다
            </p>
            <p className="text-xs" style={labelStyleMono()}>
              경기에 참여하고 골·어시스트·MOM 을 기록해보세요
            </p>
          </div>
        ) : (
          groupByCategory(earnedBadges).map((group) => (
            <div key={`earned-${group.key}`} className="mb-6 last:mb-0">
              <p
                className="text-[10px] uppercase tracking-[2px] mb-3"
                style={labelStyleMono()}
              >
                {CATEGORY_LABELS[group.key] || group.key}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {group.items.map((badge) => {
                  const isEquipped = equipped.includes(badge.id);
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => toggleEquip(badge.id)}
                      disabled={saving}
                      title={badge.description}
                      aria-pressed={isEquipped}
                      aria-label={`${badge.name} — ${isEquipped ? "장착 해제" : "장착"}`}
                      className="group relative rounded-2xl p-4 flex flex-col items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                      style={{
                        background: isEquipped ? "var(--primary)" : "var(--color-fg-paper)",
                        color: isEquipped ? "var(--color-fg-paper)" : "var(--color-fg-ink)",
                        border: `1px solid ${isEquipped ? "var(--primary)" : "var(--color-fg-blue-soft)"}`,
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background: isEquipped ? "rgba(255,255,255,0.18)" : "var(--color-fg-paper-3)",
                          color: isEquipped ? "var(--color-fg-paper)" : "var(--primary)",
                        }}
                      >
                        <IconFor icon={badge.icon} className="w-6 h-6" />
                      </div>
                      <span
                        className="text-xs font-bold text-center line-clamp-1"
                        style={{ fontFamily: "var(--font-pretendard)" }}
                      >
                        {badge.name}
                      </span>
                      <span
                        className="text-[10px] text-center line-clamp-2"
                        style={{
                          fontFamily: "var(--font-space-mono)",
                          color: isEquipped ? "rgba(255,255,255,0.85)" : "var(--color-fg-ink-muted)",
                        }}
                      >
                        {badge.description}
                      </span>
                      {isEquipped && (
                        <span
                          className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.25)", color: "var(--color-fg-paper)" }}
                        >
                          장착중
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 미획득 배지 ── */}
      <div className="px-6 max-w-3xl mx-auto mt-10">
        <SectionLabel text="Locked — 도전 중" />
        {lockedBadges.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-6 text-center"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
              모든 배지를 획득했습니다!
            </p>
          </div>
        ) : (
          groupByCategory(lockedBadges).map((group) => (
            <div key={`locked-${group.key}`} className="mb-6 last:mb-0">
              <p
                className="text-[10px] uppercase tracking-[2px] mb-3"
                style={labelStyleMono()}
              >
                {CATEGORY_LABELS[group.key] || group.key}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.items.map((badge) => {
                  const row = progressById.get(badge.id);
                  const curr = row?.progress ?? 0;
                  const max = badge.maxProgress ?? 1;
                  const pct = Math.min(100, Math.round((curr / max) * 100));
                  return (
                    <div
                      key={badge.id}
                      className="rounded-2xl p-4 flex items-center gap-3"
                      style={{
                        background: "var(--color-fg-paper)",
                        border: "1px solid var(--color-fg-line-soft)",
                        boxShadow: "var(--shadow-sm)",
                        opacity: 0.92,
                      }}
                    >
                      <div
                        className="relative w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: "var(--color-fg-paper-3)",
                          color: "var(--color-fg-ink-muted)",
                        }}
                      >
                        <IconFor icon={badge.icon} className="w-6 h-6" />
                        <span
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            background: "var(--color-fg-paper)",
                            border: "1px solid var(--color-fg-line-soft)",
                            color: "var(--color-fg-ink-muted)",
                          }}
                          aria-hidden="true"
                        >
                          <Lock className="w-2.5 h-2.5" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm" style={{ color: "var(--color-fg-ink)" }}>
                            {badge.name}
                          </span>
                          <span
                            className="text-xs tabular-nums font-bold"
                            style={{ fontFamily: "var(--font-pretendard)", color: "var(--primary)" }}
                          >
                            {curr}/{max}
                          </span>
                        </div>
                        <div
                          className="w-full h-2 rounded-full overflow-hidden mb-1.5"
                          style={{ background: "var(--color-fg-paper-3)" }}
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: "var(--primary)" }}
                          />
                        </div>
                        <p className="text-[11px] line-clamp-1" style={{ color: "var(--color-fg-ink-muted)" }}>
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
