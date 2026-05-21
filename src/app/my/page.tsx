"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut, ChevronRight, Users, Mail, Flag, Hash,
  Shield, Target, Handshake, Gamepad2, Star, CreditCard,
  Download, Share2, Loader2, Pencil, Save, X, Phone, Calendar, UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCardCaptureFrame } from "@/components/player-card-capture-frame";
import { BADGES } from "@/constants/badges";
import type { Gender, Player } from "@/types";
import { buildEditableProfileUpdate, isValidRegistrationProfile } from "@/lib/registration-profile";
import { downloadElementAsPng } from "@/lib/card-download";
import { getAdminEntryLabel, isAdminLikeRole } from "@/lib/admin-access";

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

const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
] as const;

const POSITION_LABELS: Record<string, string> = {
  GK: "GK · 골레이루",
  FIXO: "FIXO · 픽소",
  ALA: "ALA · 알라",
  PIVO: "PIVO · 피보",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  captain: "감독",
  player: "선수",
  referee: "심판",
};

const REGISTERED_TEAM_ID_KEY = "fg_registered_team_id";

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
  const { user, player, loading, initialized, logout, updatePlayer } = useAuth();
  const store = useDataStore();
  const exportCardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "" as Gender | "",
    birthDate: "",
    hasPlayerExperience: false,
    mbti: "",
    disposition: "",
    personalValues: "",
    bio: "",
  });
  const [team, setTeam] = useState<{ logo?: string } | null>(null);
  const [registeredTeamId, setRegisteredTeamId] = useState("");
  const showAdminEntry = isAdminLikeRole(player?.role);

  useEffect(() => {
    if (!player) return;
    setProfileForm({
      name: player.name || "",
      email: player.email || user?.email || "",
      phone: player.phone || "",
      gender: player.gender || "",
      birthDate: player.birthDate || "",
      hasPlayerExperience: !!player.hasPlayerExperience,
      mbti: player.mbti || "",
      disposition: player.disposition || "",
      personalValues: player.personalValues || "",
      bio: player.bio || "",
    });
  }, [player, user?.email]);

  useEffect(() => {
    const localTeamId = localStorage.getItem(REGISTERED_TEAM_ID_KEY) || "";
    setRegisteredTeamId(localTeamId);
    const teamId = player?.teamId || localTeamId;
    if (teamId) {
      store.fetchTeam(teamId).then(setTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.teamId]);

  const handleSave = async () => {
    if (!exportCardRef.current || !player) return;
    setSaving(true);
    try {
      await downloadElementAsPng(exportCardRef.current, `${player.name}-fairground.png`);
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

  const handleProfileSave = async () => {
    if (!player) return;
    const update = buildEditableProfileUpdate(profileForm);
    if (!isValidRegistrationProfile(update)) {
      setProfileMessage("이름, 전화번호, 이메일, 성별, 생년월일을 모두 입력해주세요.");
      return;
    }

    setProfileSaving(true);
    setProfileMessage("");
    try {
      await updatePlayer({
        name: update.name,
        phone: update.phone,
        email: update.email,
        gender: update.gender as Gender,
        birthDate: update.birthDate,
        hasPlayerExperience: update.hasPlayerExperience,
        mbti: profileForm.mbti.trim() || undefined,
        disposition: profileForm.disposition.trim() || undefined,
        personalValues: profileForm.personalValues.trim() || undefined,
        bio: profileForm.bio.trim() || undefined,
      });
      setEditingProfile(false);
      setProfileMessage("개인정보가 저장되었습니다.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "개인정보 저장에 실패했습니다.");
    } finally {
      setProfileSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    if (player) {
      setProfileForm({
        name: player.name || "",
        email: player.email || user?.email || "",
        phone: player.phone || "",
        gender: player.gender || "",
        birthDate: player.birthDate || "",
        hasPlayerExperience: !!player.hasPlayerExperience,
        mbti: player.mbti || "",
        disposition: player.disposition || "",
        personalValues: player.personalValues || "",
        bio: player.bio || "",
      });
    }
    setEditingProfile(false);
    setProfileMessage("");
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
                : (player?.name?.slice(0, 1) || user?.email?.slice(0, 1)?.toUpperCase() || "?")}
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
              {player?.name || user?.email?.split("@")[0] || "마이페이지"}
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
        <div className="px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-10 lg:gap-20 items-start md:items-stretch">

            {/* ── Left: 선수 카드 ── */}
            <section className="flex-shrink-0 self-center md:self-start">
              <SectionLabel text="Player Card" />
              <div className="flex flex-col items-center">
                <div ref={exportCardRef}>
                  <PlayerCardCaptureFrame
                    player={player}
                    teamLogo={team?.logo}
                    boxSize={560}
                    cardSize="lg"
                    cardScale={1.55}
                    logoHeight={27}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-4 mt-6 w-full max-w-[560px]">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#FFD700", color: "#0D1B2A" }}
                  >
                    {saving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-5 h-5" />}
                    이미지 저장
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}
                  >
                    <Share2 className="w-5 h-5" />
                    공유하기
                  </button>
                </div>

                {/* Card edit */}
                <Link
                  href="/my/card-edit"
                  className="flex items-center justify-center gap-2 mt-4 w-full max-w-[560px] py-4 rounded-2xl text-base font-bold transition-all hover:opacity-90"
                  style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}
                >
                  <Pencil className="w-5 h-5" />
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
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/my/player-setup"
                  className="inline-flex justify-center px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  style={{ background: "#FFD700", color: "#0D1B2A" }}>
                  선수 카드 만들기
                </Link>
                <Link href="/my/team"
                  className="inline-flex justify-center px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#FAFCFF" }}>
                  팀 등록하기
                </Link>
              </div>
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
            {player?.teamId || registeredTeamId ? (
              <Link href={player?.teamId ? `/teams/${player.teamId}` : "/my/team"}>
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
                <p className="text-sm mb-4" style={{ color: "#627D98" }}>소속 팀이 없습니다</p>
                <Link href="/my/team"
                  className="inline-flex px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                  style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}>
                  우리팀 등록하기
                </Link>
              </div>
            )}
          </section>

          {/* ── Right: 개인정보 ── */}
          <section className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel text="Profile" />
              {player && !editingProfile && (
                <button
                  type="button"
                  onClick={() => { setEditingProfile(true); setProfileMessage(""); }}
                  className="mb-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:opacity-80"
                  style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.25)", color: "#00C853" }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  개인정보 수정
                </button>
              )}
            </div>
            <div className="rounded-2xl px-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {!editingProfile ? (
                <>
                  <InfoRow
                    icon={<Mail className="w-4 h-4" />}
                    label="계정"
                    value={player?.email || user?.email || "비로그인 등록 모드"}
                  />
                  {player && (
                    <>
                      <InfoRow icon={<Hash className="w-4 h-4" />} label="이름 · 등번호"
                        value={`${player.name} · #${player.number}`} />
                      <InfoRow icon={<Phone className="w-4 h-4" />} label="전화번호"
                        value={player.phone || "미입력"} />
                      <InfoRow icon={<UserRound className="w-4 h-4" />} label="성별"
                        value={player.gender === "male" ? "남성" : player.gender === "female" ? "여성" : player.gender === "other" ? "기타" : player.gender === "prefer_not_to_say" ? "응답 안 함" : "미입력"} />
                      <InfoRow icon={<Calendar className="w-4 h-4" />} label="생년월일"
                        value={player.birthDate || "미입력"} />
                      <InfoRow icon={<Shield className="w-4 h-4" />} label="선수 경력"
                        value={player.hasPlayerExperience ? "경력 있음" : "없음 / 처음"} />
                      <InfoRow icon={<Shield className="w-4 h-4" />} label="포지션"
                        value={POSITION_LABELS[player.position] || player.position} />
                      <InfoRow icon={<Flag className="w-4 h-4" />} label="국적"
                        value={player.nationality} />
                      {(player.mbti || player.disposition || player.personalValues) && (
                        <div className="py-3.5 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex flex-wrap gap-1.5">
                            {player.mbti && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                                style={{ background: "rgba(79,195,247,0.12)", color: "#4FC3F7", fontFamily: "var(--font-space-mono)" }}>
                                MBTI · {player.mbti}
                              </span>
                            )}
                            {player.disposition && (
                              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                                style={{ background: "rgba(0,200,83,0.12)", color: "#00C853", fontFamily: "var(--font-space-mono)" }}>
                                성향 · {player.disposition}
                              </span>
                            )}
                          </div>
                          {player.personalValues && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wider mb-1"
                                style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>가치관</div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#FAFCFF" }}>{player.personalValues}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="space-y-4 py-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>이름</label>
                    <input
                      value={profileForm.name}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>연락 이메일</label>
                    <input
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>전화번호</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>성별</label>
                      <select
                        value={profileForm.gender}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, gender: event.target.value as Gender | "" }))}
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                      >
                        <option value="" style={{ color: "#0D1B2A" }}>선택</option>
                        <option value="male" style={{ color: "#0D1B2A" }}>남성</option>
                        <option value="female" style={{ color: "#0D1B2A" }}>여성</option>
                        <option value="other" style={{ color: "#0D1B2A" }}>기타</option>
                        <option value="prefer_not_to_say" style={{ color: "#0D1B2A" }}>응답 안 함</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>생년월일</label>
                      <input
                        type="date"
                        value={profileForm.birthDate}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, hasPlayerExperience: true }))}
                      className="rounded-xl py-2.5 text-sm font-bold transition-all"
                      style={{ background: profileForm.hasPlayerExperience ? "#FFD700" : "rgba(255,255,255,0.06)", color: profileForm.hasPlayerExperience ? "#0D1B2A" : "#FAFCFF" }}
                    >
                      선수 경력 있음
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, hasPlayerExperience: false }))}
                      className="rounded-xl py-2.5 text-sm font-bold transition-all"
                      style={{ background: !profileForm.hasPlayerExperience ? "#FFD700" : "rgba(255,255,255,0.06)", color: !profileForm.hasPlayerExperience ? "#0D1B2A" : "#FAFCFF" }}
                    >
                      없음 / 처음
                    </button>
                  </div>

                  {/* ── 신규 프로필 필드 ── */}
                  <div className="space-y-1.5">
                    <label htmlFor="my-mbti" className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>MBTI</label>
                    <select
                      id="my-mbti"
                      value={profileForm.mbti}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, mbti: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    >
                      <option value="" style={{ color: "#0D1B2A" }}>선택 안 함</option>
                      {MBTI_TYPES.map((type) => (
                        <option key={type} value={type} style={{ color: "#0D1B2A" }}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-disposition" className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>성향</label>
                    <input
                      id="my-disposition"
                      type="text"
                      placeholder="예: 적극적 / 분석적 / 협동적"
                      value={profileForm.disposition}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, disposition: event.target.value }))}
                      maxLength={200}
                      aria-describedby="my-disposition-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                    <p id="my-disposition-help" className="text-[10px] pl-1" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
                      한 줄 · 최대 200자 ({profileForm.disposition.length}/200)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-values" className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>추구하는 가치관</label>
                    <textarea
                      id="my-values"
                      rows={3}
                      placeholder="내가 그라운드에서 중요하게 여기는 것"
                      value={profileForm.personalValues}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, personalValues: event.target.value }))}
                      maxLength={500}
                      aria-describedby="my-values-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                    <p id="my-values-help" className="text-[10px] pl-1" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
                      최대 500자 ({profileForm.personalValues.length}/500)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-bio" className="text-[10px] uppercase tracking-wider" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>자기소개</label>
                    <textarea
                      id="my-bio"
                      rows={5}
                      placeholder="내 플레이 스타일·강점·연락처 등을 자유롭게 — 팀 영입 안내에 사용됩니다"
                      value={profileForm.bio}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                      maxLength={2000}
                      aria-describedby="my-bio-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#FAFCFF" }}
                    />
                    <p id="my-bio-help" className="text-[10px] pl-1" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
                      최대 2000자 ({profileForm.bio.length}/2000)
                    </p>
                  </div>

                  {profileMessage && (
                    <p className="text-xs" style={{ color: profileMessage.includes("저장") ? "#00C853" : "#FF6B6B" }}>{profileMessage}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={cancelProfileEdit}
                      disabled={profileSaving}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#FAFCFF" }}
                    >
                      <X className="h-4 w-4" /> 취소
                    </button>
                    <button
                      type="button"
                      onClick={handleProfileSave}
                      disabled={profileSaving}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: "#FFD700", color: "#0D1B2A" }}
                    >
                      {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!editingProfile && profileMessage && (
              <p className="mt-2 text-xs" style={{ color: profileMessage.includes("저장") ? "#00C853" : "#FF6B6B" }}>{profileMessage}</p>
            )}
          </section>

        </div>
      </div>

      {/* ── 자기소개 (bio) ── */}
      {player?.bio && !editingProfile && (
        <div className="px-6 max-w-4xl mx-auto mt-10">
          <SectionLabel text="About Me" />
          <div className="rounded-2xl px-5 py-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#FAFCFF" }}>
              {player.bio}
            </p>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-6 pb-16 max-w-4xl mx-auto mt-10">

        {/* ── 관리자/심판 운영 진입 ── */}
        {showAdminEntry && (
          <Link
            href="/admin"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "#FFD700", color: "#0D1B2A" }}
          >
            <Shield className="h-4 w-4" />
            {getAdminEntryLabel(player?.role)} 페이지로 이동
          </Link>
        )}

        {/* ── 로그아웃 ── */}
        {user && (
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
            style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", color: "#FF6B6B" }}>
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        )}

      </div>
    </div>
  );
}
