"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut, ChevronRight, Users, Mail, Flag, Hash,
  Shield, Target, Handshake, Gamepad2, Star, CreditCard,
  Download, Share2, Loader2, Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import { BADGES } from "@/constants/badges";
import type { Player } from "@/types";

/** 스탯 기반으로 진행률을 추적할 수 있는 뱃지 매핑 (priority 낮을수록 쉬운 목표) */
const TRACKABLE_BADGES: Record<string, { fn: (s: Player["stats"]) => number; priority: number }> = {
  debut:        { fn: (s) => Math.min(s.games, 1),   priority: 1 },
  first_goal:   { fn: (s) => Math.min(s.goals, 1),   priority: 2 },
  mvp:          { fn: (s) => Math.min(s.mom, 5),      priority: 3 },
  playmaker:    { fn: (s) => Math.min(s.assists, 10), priority: 4 },
  goal_machine: { fn: (s) => Math.min(s.goals, 10),  priority: 5 },
  iron_man:     { fn: (s) => Math.min(s.games, 20),   priority: 6 },
};

function getNextBadgeGoals(player: Player, count = 6) {
  const owned = new Set(player.badges ?? []);
  const candidates: { badge: typeof BADGES[number]; current: number; max: number; pct: number; priority: number }[] = [];

  for (const badge of BADGES) {
    if (owned.has(badge.id)) continue;
    if (badge.category === "referee") continue;
    if (badge.category === "goalkeeper" && player.position !== "GK") continue;
    const entry = TRACKABLE_BADGES[badge.id];
    if (!entry || !badge.maxProgress) continue;

    const current = entry.fn(player.stats);
    const pct = current / badge.maxProgress;
    if (pct >= 1) continue;

    candidates.push({ badge, current, max: badge.maxProgress, pct, priority: entry.priority });
  }

  return candidates
    .sort((a, b) => b.pct - a.pct || a.priority - b.priority)
    .slice(0, count);
}

const POSITION_LABELS: Record<string, string> = {
  GK: "GK · 골레이루",
  FIXO: "FIXO · 픽소",
  ALA: "ALA · 알라",
  PIVO: "PIVO · 피보",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "감독",
  captain: "주장",
  player: "선수",
};

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] uppercase tracking-[3px] mb-4"
      style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>
      {text}
    </p>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-8 flex justify-center flex-shrink-0" style={{ color: "#627D98" }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider mb-0.5"
          style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>{label}</div>
        <div className="text-sm font-medium truncate" style={{ color: "#FAFCFF" }}>{value}</div>
      </div>
    </div>
  );
}

function StatBox({ value, label, color, icon }: {
  value: number; label: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl p-4 md:p-6 gap-2 md:gap-3"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-7 md:[&>svg]:h-7" style={{ color }}>{icon}</div>
      <span className="font-black text-2xl md:text-5xl tabular-nums leading-none"
        style={{ fontFamily: "var(--font-outfit)", color }}>{value}</span>
      <span className="text-[9px] md:text-xs uppercase tracking-wider text-center"
        style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>{label}</span>
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { user, player, loading, initialized, logout } = useAuth();
  const store = useDataStore();
  const cardBoxRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<{ logo?: string } | null>(null);

  useEffect(() => {
    if (player?.teamId) {
      store.fetchTeam(player.teamId).then(setTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.teamId]);

  const handleSave = async () => {
    if (!cardBoxRef.current || !player) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardBoxRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `${player.name}-fairground.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!player) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${player.name} - FairGround`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  };

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0D1B2A" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#00C853", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "#627D98" }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "#0D1B2A" }}>
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: "rgba(0,200,83,0.1)", border: "1px solid rgba(0,200,83,0.2)" }}>
            <CreditCard className="h-9 w-9" style={{ color: "#00C853" }} />
          </div>
          <div>
            <h2 className="font-black text-2xl mb-2"
              style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-1px", color: "#FAFCFF" }}>
              로그인이 필요합니다
            </h2>
            <p className="text-sm" style={{ color: "#627D98" }}>마이페이지를 이용하려면 로그인해주세요</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/login?returnTo=%2Fmy")}
              className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "#FFD700", color: "#0D1B2A" }}>
              로그인
            </button>
            <button
              onClick={() => router.push("/register")}
              className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}>
              회원가입
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[60px]" style={{ background: "#0D1B2A" }}>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-6 pt-8 pb-10"
        style={{ background: "linear-gradient(180deg, rgba(0,200,83,0.07) 0%, transparent 100%)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex items-center justify-center font-black text-2xl"
              style={{
                background: (player?.profilePhotoUrl || player?.photoUrl) ? "transparent" : "rgba(0,200,83,0.12)",
                border: "2px solid rgba(0,200,83,0.3)",
                color: "#00C853",
                fontFamily: "var(--font-outfit)",
              }}>
              {(player?.profilePhotoUrl || player?.photoUrl)
                ? <img src={player.profilePhotoUrl || player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                : (player?.name?.slice(0, 1) || user.email?.slice(0, 1)?.toUpperCase() || "?")}
            </div>
            {player?.cardRating && (
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: "#FFD700", color: "#0D1B2A", fontFamily: "var(--font-outfit)" }}>
                {player.cardRating}
              </div>
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-[28px] leading-none mb-2 truncate"
              style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-1.5px", color: "#FAFCFF" }}>
              {player?.name || user.email?.split("@")[0] || "선수"}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {player?.position && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(0,200,83,0.12)", color: "#00C853", fontFamily: "var(--font-space-mono)" }}>
                  {player.position}
                </span>
              )}
              {player?.role && player.role !== "player" && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(79,195,247,0.12)", color: "#4FC3F7", fontFamily: "var(--font-space-mono)" }}>
                  {ROLE_LABELS[player.role] || player.role}
                </span>
              )}
              {player?.cardType === "premium" && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700", fontFamily: "var(--font-space-mono)" }}>
                  PREMIUM
                </span>
              )}
              {player && !player.isApproved && (
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B", fontFamily: "var(--font-space-mono)" }}>
                  승인 대기
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card + Stats Row ── */}
      {player ? (
        <div className="px-6 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-stretch">

            {/* ── Left: 선수 카드 ── */}
            <section className="flex-shrink-0 self-center md:self-start">
              <SectionLabel text="Player Card" />
              <div className="flex flex-col items-center">
                {/* Card with space background */}
                <div
                  ref={cardBoxRef}
                  className="relative overflow-hidden rounded-2xl"
                  style={{ width: 320, height: 320 }}
                >
                  {/* Space bg */}
                  <img
                    src="/images/space-bg.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
                  {/* Gold glow */}
                  <div
                    className="absolute"
                    style={{
                      left: "50%", top: "45%",
                      transform: "translate(-50%, -50%)",
                      width: "80%", height: "80%",
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0.08) 40%, transparent 65%)",
                    }}
                  />
                  {/* Light rays */}
                  {[-18, -6, 0, 6, 18].map((deg, i) => (
                    <div key={i} className="absolute" style={{
                      left: "50%", top: 0,
                      width: i === 2 ? 3 : 2,
                      height: "130%",
                      background: `linear-gradient(to bottom, transparent 0%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 30%, rgba(201,168,76,${i === 2 ? 0.15 : 0.06}) 48%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 66%, transparent 100%)`,
                      transform: `translateX(-50%) rotate(${deg}deg)`,
                      transformOrigin: "50% 45%",
                    }} />
                  ))}
                  {/* Card centered */}
                  <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: "6%" }}>
                    <div style={{ transform: "scale(0.92)", transformOrigin: "center center" }}>
                      <PlayerCard player={player} size="lg" teamLogo={team?.logo} />
                    </div>
                  </div>
                  {/* Bottom logo */}
                  <div
                    className="absolute pointer-events-none flex justify-center"
                    style={{ left: 0, right: 0, bottom: "4%", zIndex: 3 }}
                  >
                    <img
                      src="/images/logo-horizontal.png"
                      alt="FAIRGROUND"
                      style={{ height: 16, opacity: 0.9 }}
                      draggable={false}
                    />
                  </div>
                  {/* Edge vignette */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse 65% 60% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)" }}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-5 w-full max-w-[320px]">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#FFD700", color: "#0D1B2A" }}
                  >
                    {saving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />}
                    이미지 저장
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}
                  >
                    <Share2 className="w-4 h-4" />
                    공유하기
                  </button>
                </div>

                {/* Card edit */}
                <Link
                  href="/my/card-edit"
                  className="flex items-center justify-center gap-2 mt-3 w-full max-w-[320px] py-3 rounded-2xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}
                >
                  <Pencil className="w-4 h-4" />
                  카드 수정
                </Link>
              </div>
            </section>

            {/* ── Right: 개인 기록 ── */}
            <section className="flex-1 min-w-0 w-full flex flex-col">
              <SectionLabel text="Stats" />
              <div className="grid grid-cols-4 md:grid-cols-2 md:grid-rows-2 gap-3 mb-3 md:flex-1">
                <StatBox value={player.stats.goals} label="골" color="#4FC3F7"
                  icon={<Target className="w-4 h-4" />} />
                <StatBox value={player.stats.assists} label="어시스트" color="#00C853"
                  icon={<Handshake className="w-4 h-4" />} />
                <StatBox value={player.stats.games} label="경기" color="#CE93D8"
                  icon={<Gamepad2 className="w-4 h-4" />} />
                <StatBox value={player.stats.mom} label="MOM" color="#FFD700"
                  icon={<Star className="w-4 h-4" />} />
              </div>
              {/* Rating bar */}
              <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
                style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)" }}>
                <div>
                  <p className="text-[10px] uppercase tracking-[2px] mb-0.5"
                    style={{ fontFamily: "var(--font-space-mono)", color: "#FFD70099" }}>Overall Rating</p>
                  <div className="flex items-end gap-1">
                    <span className="font-black text-4xl tabular-nums leading-none"
                      style={{ fontFamily: "var(--font-outfit)", color: "#FFD700" }}>
                      {player.cardRating}
                    </span>
                    <span className="text-xs mb-1" style={{ color: "#FFD70066" }}>/100</span>
                  </div>
                </div>
                {/* Mini rating bar */}
                <div className="w-28 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,215,0,0.15)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${player.cardRating}%`, background: "linear-gradient(90deg, #FFD700, #FFA726)" }} />
                </div>
              </div>

            </section>

          </div>
        </div>
      ) : (
        <div className="px-6 max-w-2xl mx-auto">
          <section>
            <SectionLabel text="Player Card" />
            <div className="rounded-2xl p-8 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)" }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                <CreditCard className="w-6 h-6" style={{ color: "#FFD700" }} />
              </div>
              <p className="font-bold text-sm mb-1" style={{ color: "#FAFCFF" }}>선수 카드가 없습니다</p>
              <p className="text-xs mb-5" style={{ color: "#627D98" }}>선수 등록 후 나만의 카드가 생성됩니다</p>
              <Link href="/my/player-setup"
                className="inline-flex px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                style={{ background: "#FFD700", color: "#0D1B2A" }}>
                선수 카드 만들기
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* ── Next Badges ── */}
      {player && (() => {
        const goals = getNextBadgeGoals(player);
        if (goals.length === 0) return null;
        return (
          <div className="px-6 max-w-4xl mx-auto mt-10">
            <SectionLabel text="Next Badges" />
            <div className="rounded-2xl px-5 py-5"
              style={{ background: "rgba(0,200,83,0.05)", border: "1px solid rgba(0,200,83,0.15)" }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map((goal) => (
                  <div key={goal.badge.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(0,200,83,0.1)", border: "1px solid rgba(0,200,83,0.2)" }}>
                      <img src={goal.badge.imageUrl} alt={goal.badge.name} className="w-10 h-10 object-contain" draggable={false} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm" style={{ color: "#FAFCFF" }}>
                          {goal.badge.name}
                        </span>
                        <span className="text-xs tabular-nums font-bold"
                          style={{ fontFamily: "var(--font-outfit)", color: "#00C853" }}>
                          {goal.current}/{goal.max}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: "rgba(0,200,83,0.15)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round(goal.pct * 100)}%`, background: "linear-gradient(90deg, #00C853, #4FC3F7)" }} />
                      </div>
                      <p className="text-[10px] mt-1.5" style={{ color: "#627D98" }}>
                        {goal.badge.unlockCondition}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Team + Profile Row ── */}
      <div className="px-6 max-w-4xl mx-auto mt-10">
        <div className="flex flex-col md:flex-row gap-8 md:items-stretch">

          {/* ── Left: 팀 정보 ── */}
          <section className="flex-1 min-w-0">
            <SectionLabel text="Team" />
            {player?.teamId ? (
              <Link href={`/teams/${player.teamId}`}>
                <div className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(0,200,83,0.12)", border: "1px solid rgba(0,200,83,0.2)" }}>
                    <Users className="w-5 h-5" style={{ color: "#00C853" }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm mb-0.5" style={{ color: "#FAFCFF" }}>소속 팀</p>
                    <p className="text-xs" style={{ color: "#627D98" }}>팀 로스터 · 시즌 기록 · 팀 게시판</p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#627D98" }} />
                </div>
              </Link>
            ) : (
              <div className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
                <p className="text-sm" style={{ color: "#627D98" }}>소속 팀이 없습니다</p>
              </div>
            )}
          </section>

          {/* ── Right: 개인정보 ── */}
          <section className="flex-1 min-w-0">
            <SectionLabel text="Profile" />
            <div className="rounded-2xl px-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <InfoRow icon={<Mail className="w-4 h-4" />} label="이메일" value={user.email || "-"} />
              {player && (
                <>
                  <InfoRow icon={<Hash className="w-4 h-4" />} label="이름 · 등번호"
                    value={`${player.name} · #${player.number}`} />
                  <InfoRow icon={<Shield className="w-4 h-4" />} label="포지션"
                    value={POSITION_LABELS[player.position] || player.position} />
                  <InfoRow icon={<Flag className="w-4 h-4" />} label="국적"
                    value={player.nationality} />
                </>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 pb-16 max-w-4xl mx-auto mt-10">

        {/* ── 로그아웃 ── */}
        <button
          onClick={async () => { await logout(); router.push("/"); }}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#FF6B6B" }}>
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>

      </div>
    </div>
  );
}
