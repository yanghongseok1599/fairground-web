"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut, ChevronRight, Users, Mail, Flag, Hash,
  Shield, Target, Handshake, Gamepad2, Star, CreditCard,
  Download, Share2, Loader2, Pencil, Save, X, Phone, Calendar, UserRound,
  Award, Brain, Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCardCaptureFrame } from "@/components/player-card-capture-frame";
import { BADGES } from "@/constants/badges";
import type { Gender, Player, PlayerCardSkin, Team, TeamJoinRequest } from "@/types";
import {
  PLAYER_CARD_SKIN_LABELS,
  getUnlockedCardSkins,
  readCardSkinPreference,
  withCardSkin,
  writeCardSkinPreference,
} from "@/lib/player-card-skin";
import { buildEditableProfileUpdate, isValidRegistrationProfile } from "@/lib/registration-profile";
import { downloadElementAsPng, shareElementAsPng } from "@/lib/card-download";
import { getAdminEntryLabel, isAdminLikeRole } from "@/lib/admin-access";
import { canManageTeam } from "@/lib/team-permissions";
import { CardProgress } from "@/components/card-progress";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { compressImageBlob, removeBackgroundAndCompress } from "@/lib/image-compression";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";

/* ===========================================================
 * Light theme (White&Blue) — FairGround BrandKit 2026
 * 모든 다크/녹색/골드 강조는 브랜드 블루·ink 톤으로 통일.
 * 카드: 흰 배경 + --color-fg-line-soft 보더 + --shadow-sm.
 * 본문 ink, 보조 ink-muted (14px↑ 만 사용).
 * =========================================================== */

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
// 760px player card + 420px side panel + 56px xl gap. Keep page sections aligned.
const MY_PAGE_SECTION_SHELL = "px-4 sm:px-6 max-w-[1236px] mx-auto";

const inputStyle: React.CSSProperties = {
  background: "var(--color-fg-paper)",
  border: "1px solid var(--color-fg-line-soft)",
  color: "var(--color-fg-ink)",
};

const labelStyleMono: React.CSSProperties = {
  color: "var(--color-fg-ink-muted)",
  fontFamily: "var(--font-space-mono)",
};

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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="flex items-center gap-4 py-3.5"
      style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
    >
      <div className="w-8 flex justify-center flex-shrink-0" style={{ color: "var(--primary)" }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] uppercase tracking-wider mb-0.5"
          style={labelStyleMono}
        >
          {label}
        </div>
        <div className="text-sm font-medium truncate" style={{ color: "var(--color-fg-ink)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function StatBox({ value, label, icon }: {
  value: number; label: string; icon: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl p-4 md:p-6 gap-2 md:gap-3"
      style={{
        background: "var(--color-fg-paper)",
        border: "1px solid var(--color-fg-line-soft)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="[&>svg]:w-4 [&>svg]:h-4 md:[&>svg]:w-7 md:[&>svg]:h-7" style={{ color: "var(--primary)" }}>
        {icon}
      </div>
      <span
        className="font-black text-2xl md:text-5xl tabular-nums leading-none"
        style={{ fontFamily: "var(--font-pretendard)", color: "var(--color-fg-ink)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] md:text-xs uppercase tracking-wider text-center"
        style={labelStyleMono}
      >
        {label}
      </span>
    </div>
  );
}

export default function MyPage() {
  const router = useRouter();
  const { user, player, initialized, logout, updatePlayer, uploadPlayerPhoto } = useAuth();
  const store = useDataStore();
  const exportCardRef = useRef<HTMLDivElement>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoObjectUrlRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [cardSkinChoice, setCardSkinChoice] = useState<PlayerCardSkin>("standard");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [profilePhotoMessage, setProfilePhotoMessage] = useState("");
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
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
  const [team, setTeam] = useState<Team | null>(null);
  const [registeredTeamId, setRegisteredTeamId] = useState("");
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>([]);
  const showAdminEntry = isAdminLikeRole(player?.role);
  const isAdminProfile = player?.role === "admin";
  const managedTeamId = player?.teamId || registeredTeamId;
  const canManageCurrentTeam = canManageTeam(player, team);
  const isPendingTeamMember = Boolean(player?.teamId && !player.isApproved);

  // 보유 카드 목록 — 대회 카드는 항상, 그라운드 챌린지 카드는 받은 선수만.
  const unlockedCardSkins = getUnlockedCardSkins(player);
  const canChooseCardSkin = unlockedCardSkins.length > 1;
  const unlockedKey = unlockedCardSkins.join(",");

  useEffect(() => {
    setCardSkinChoice(
      readCardSkinPreference(unlockedKey.split(",") as PlayerCardSkin[]),
    );
  }, [unlockedKey]);

  const chooseCardSkin = (skin: PlayerCardSkin) => {
    setCardSkinChoice(skin);
    writeCardSkinPreference(skin);
  };

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
    return () => {
      if (profilePhotoObjectUrlRef.current) {
        URL.revokeObjectURL(profilePhotoObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const localTeamId = localStorage.getItem(REGISTERED_TEAM_ID_KEY) || "";
    setRegisteredTeamId(localTeamId);
    const teamId = player?.teamId || localTeamId;
    if (teamId) {
      store.fetchTeam(teamId).then(setTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.teamId]);

  // 본인 가입 신청 상태 — pending(승인 대기) 또는 최근 rejected(7일 이내) 1건씩
  // 노출. approved는 player.teamId가 이미 세팅되니 별도 안내 불필요.
  useEffect(() => {
    if (!player?.id) {
      setJoinRequests([]);
      return;
    }
    let cancelled = false;
    void store.fetchMyJoinRequests(player.id).then((list) => {
      if (!cancelled) setJoinRequests(list);
    });
    return () => {
      cancelled = true;
    };
  }, [player?.id, store]);

  const handleSave = async () => {
    if (!exportCardRef.current || !player) return;
    setShareMessage("");
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
    if (!exportCardRef.current || !player) return;
    setShareMessage("");
    setSharing(true);
    try {
      const result = await shareElementAsPng(exportCardRef.current, `${player.name}-fairground.png`, {
        title: `${player.name} - FairGround`,
        text: "FairGround 선수 카드",
      });
      if (result === "downloaded") {
        setShareMessage("이 브라우저는 이미지 공유를 지원하지 않아 저장으로 처리했습니다.");
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage("공유가 열리지 않아 링크를 복사했습니다.");
      } catch {
        setShareMessage("공유를 실행하지 못했습니다. 저장하기를 이용해주세요.");
      }
      console.error(e);
    } finally {
      setSharing(false);
      window.setTimeout(() => setShareMessage(""), 3500);
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

  const setProfilePhotoObjectUrl = (url: string) => {
    if (profilePhotoObjectUrlRef.current) {
      URL.revokeObjectURL(profilePhotoObjectUrlRef.current);
    }
    profilePhotoObjectUrlRef.current = url;
    setProfilePhotoPreview(url);
  };

  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !player) return;

    setProfilePhotoSaving(true);
    setProfilePhotoMessage("프로필 이미지를 처리하고 있습니다.");
    try {
      const compressed = await compressImageBlob(file, {
        maxPx: 1400,
        mimeType: "image/webp",
        quality: 0.9,
      });

      let outputBlob = compressed;
      let removedBackground = true;
      try {
        outputBlob = await removeBackgroundAndCompress(compressed, {
          maxPx: 1400,
          mimeType: "image/webp",
          quality: 0.92,
        });
      } catch (error) {
        removedBackground = false;
        console.error("[MyPage] profile background removal failed:", error);
      }

      setProfilePhotoObjectUrl(URL.createObjectURL(outputBlob));
      const profileFile = new File([outputBlob], "profile.webp", {
        type: outputBlob.type || "image/webp",
      });
      const uploadedUrl = await uploadPlayerPhoto(profileFile);
      await updatePlayer({ profilePhotoUrl: uploadedUrl, profilePhotoLocked: true });
      setProfilePhotoMessage(
        removedBackground
          ? "프로필 이미지가 저장되었습니다."
          : "배경 제거 없이 프로필 이미지가 저장되었습니다.",
      );
    } catch (error) {
      setProfilePhotoMessage(error instanceof Error ? error.message : "프로필 이미지 저장에 실패했습니다.");
    } finally {
      setProfilePhotoSaving(false);
      if (event.target) event.target.value = "";
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-fg-paper)" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  // 노출용 신청 추리기: 보류는 모두, 거부는 가장 최근 1건만(7일 이내), 승인은 무시.
  const pendingJoinRequests = joinRequests.filter((r) => r.status === "pending");
  const recentRejected = (() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - sevenDaysMs;
    const rejected = joinRequests
      .filter((r) => r.status === "rejected" && r.createdAt >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);
    return rejected[0] ?? null;
  })();

  const cancelJoinRequest = async (req: TeamJoinRequest) => {
    if (!confirm(`${req.teamName ?? "팀"} 가입 신청을 취소할까요?`)) return;
    try {
      await store.cancelMyJoinRequest(req.id);
      if (player?.id) {
        const list = await store.fetchMyJoinRequests(player.id);
        setJoinRequests(list);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "취소 실패");
    }
  };

  // 프로필 보완 — 가입 폼은 슬림화되어 phone/gender/birthDate 같은 핵심
  // 추가 정보가 미입력 상태로 들어올 수 있다(OAuth 가입자도 마찬가지). 한 개라도
  // 비어 있으면 안내 배너 노출, 모두 채우면 자동 숨김. MBTI/성향/가치관/자기소개는
  // 옵션 자기표현이라 보완 알림 대상에서 제외.
  const missingProfileFields: string[] = [];
  if (player && !player.phone?.trim()) missingProfileFields.push("전화번호");
  if (player && !player.gender) missingProfileFields.push("성별");
  if (player && !player.birthDate?.trim()) missingProfileFields.push("생년월일");
  const showProfileCompletionBanner =
    !!player && missingProfileFields.length > 0 && !editingProfile;
  const playerCardDisplayWidth = "clamp(320px, 54vw, 760px)";

  // 보유 카드가 둘 이상이면(=그라운드 챌린지 카드를 받은 선수) 어떤 카드를
  // 보여줄지 고를 수 있다. 기본은 언제나 대회 카드이고, 선택은 기기에 저장된다.
  // 공유·저장은 화면에 보이는 카드를 그대로 캡처하므로 선택이 그대로 반영된다.

  return (
    <div className="min-h-screen pt-[60px]" style={{ background: "var(--color-fg-paper)" }}>

      {/* ── 프로필 보완 banner ──
          phone/gender/birthDate 중 하나라도 미입력이면 안내. CTA 는 "개인정보
          수정" 모달을 직접 열어 한 화면에서 모두 채우게 함. */}
      {showProfileCompletionBanner && (
        <div
          className="pt-4"
          style={{ background: "var(--color-fg-paper-2)" }}
        >
          <div className={MY_PAGE_SECTION_SHELL}>
            <div
              className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
              style={{
                background: "rgba(0,71,171,0.06)",
                borderColor: "rgba(0,71,171,0.20)",
                color: "var(--color-fg-ink)",
              }}
              role="status"
            >
              <div className="min-w-0">
                <p className="font-bold">프로필을 완성해보세요</p>
                <p
                  className="mt-0.5 text-[11px]"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  미입력: {missingProfileFields.join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(true);
                  setProfileMessage("");
                }}
                className="shrink-0 rounded-md px-3 py-1.5 text-[11px] font-bold"
                style={{
                  background: "var(--primary)",
                  color: "var(--color-fg-paper)",
                }}
              >
                보완하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 본인 신청 상태 banner ──
          가입 신청이 pending이거나 최근 거부됐을 때만 노출. 이미 팀에 합류한
          유저(player.teamId)면 과거 거부 이력은 노이즈이므로 전체 숨김. */}
      {!player?.teamId && (pendingJoinRequests.length > 0 || recentRejected) && (
        <div
          className="pt-4"
          style={{ background: "var(--color-fg-paper-2)" }}
        >
          <div className={`${MY_PAGE_SECTION_SHELL} space-y-2`}>
            {pendingJoinRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "rgba(0,71,171,0.06)",
                  borderColor: "rgba(0,71,171,0.20)",
                  color: "var(--color-fg-ink)",
                }}
                role="status"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {req.teamName ?? "팀"} 가입 신청 승인 대기 중
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                    감독·매니저가 확인하면 자동으로 팀에 합류됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void cancelJoinRequest(req)}
                  className="shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    borderColor: "rgba(0,71,171,0.20)",
                    color: "var(--primary)",
                    background: "var(--color-fg-paper)",
                  }}
                >
                  취소
                </button>
              </div>
            ))}
            {recentRejected && (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "rgba(255,59,48,0.06)",
                  borderColor: "rgba(255,59,48,0.22)",
                  color: "var(--color-fg-ink)",
                }}
                role="status"
              >
                <div className="min-w-0">
                  <p className="font-bold">
                    {recentRejected.teamName ?? "팀"} 가입 신청이 거부되었습니다
                  </p>
                  <p
                    className="mt-0.5 text-[11px]"
                    style={{ color: "var(--color-fg-ink-muted)" }}
                  >
                    다른 팀에 다시 신청해보세요.
                  </p>
                </div>
                <Link
                  href="/teams"
                  className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: "var(--primary)",
                    color: "var(--color-fg-paper)",
                  }}
                >
                  팀 찾기
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden pt-8 pb-10"
        style={{ background: "var(--color-fg-paper-2)" }}
      >
        <div className={`${MY_PAGE_SECTION_SHELL} flex items-center gap-5`}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <PlayerProfilePhoto
              src={profilePhotoPreview || getPlayerProfilePhotoUrl(player)}
              alt={player?.name || user?.email || "프로필"}
              className="h-16 w-16 rounded-2xl sm:h-[72px] sm:w-[72px]"
              icon={UserRound}
            />
            {player?.cardRating && !isAdminProfile && (
              <div
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{
                  background: "var(--primary)",
                  color: "var(--color-fg-paper)",
                  fontFamily: "var(--font-pretendard)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {player.cardRating}
              </div>
            )}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <h1
              className="font-black text-[22px] sm:text-[28px] leading-none mb-2 truncate"
              style={{
                fontFamily: "var(--font-pretendard)",
                letterSpacing: "-1.5px",
                color: "var(--color-fg-ink)",
              }}
            >
              {player?.name || user?.email?.split("@")[0] || "마이페이지"}
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {player?.position && !isAdminProfile && (
                <span
                  className="text-xs px-2.5 py-1.5 rounded-full font-bold"
                  style={{
                    background: "var(--color-fg-paper)",
                    color: "var(--primary)",
                    border: "1px solid var(--color-fg-blue-soft)",
                    fontFamily: "var(--font-space-mono)",
                  }}
                >
                  {player.position}
                </span>
              )}
              {player?.role && player.role !== "player" && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                  style={{
                    background: "var(--color-fg-paper)",
                    color: "var(--color-fg-blue-deep)",
                    border: "1px solid var(--color-fg-blue-soft)",
                    fontFamily: "var(--font-space-mono)",
                  }}
                >
                  {ROLE_LABELS[player.role] || player.role}
                </span>
              )}
              {player && !isAdminProfile && player.cardRating >= 100 && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                  style={{
                    background: "var(--primary)",
                    color: "var(--color-fg-paper)",
                    fontFamily: "var(--font-space-mono)",
                  }}
                >
                  PLATINUM
                </span>
              )}
              {player && !player.isApproved && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                  style={{
                    background: "var(--color-fg-paper)",
                    color: "var(--destructive)",
                    border: "1px solid var(--destructive)",
                    fontFamily: "var(--font-space-mono)",
                  }}
                >
                  승인 대기
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Card + Stats Row ── */}
      {player ? (
        isAdminProfile ? (
          <div className={`${MY_PAGE_SECTION_SHELL} mt-8`}>
            <SectionLabel text="Admin Profile" />
            <div
              className="rounded-2xl border p-6 md:p-8"
              style={{
                background: "var(--color-fg-paper)",
                borderColor: "var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border"
                    style={{
                      background: "var(--color-fg-paper-3)",
                      borderColor: "var(--color-fg-blue-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    <Shield className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>
                      CONTROL ACCOUNT
                    </div>
                    <h2 className="mt-1 text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>
                      {player.name || "관리자"}
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {player.email || user?.email || "관리자 계정"}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold"
                  style={{
                    background: "var(--primary)",
                    color: "var(--color-fg-paper)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Shield className="h-4 w-4" />
                  관리자 콘솔
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-fg-line-soft)", background: "var(--color-fg-paper-2)" }}>
                  <div className="text-[10px] uppercase tracking-[2px]" style={{ color: "var(--color-fg-ink-muted)" }}>Role</div>
                  <div className="mt-2 font-black" style={{ color: "var(--color-fg-ink)" }}>관리자</div>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-fg-line-soft)", background: "var(--color-fg-paper-2)" }}>
                  <div className="text-[10px] uppercase tracking-[2px]" style={{ color: "var(--color-fg-ink-muted)" }}>Access</div>
                  <div className="mt-2 font-black" style={{ color: "var(--color-fg-ink)" }}>운영 전체</div>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-fg-line-soft)", background: "var(--color-fg-paper-2)" }}>
                  <div className="text-[10px] uppercase tracking-[2px]" style={{ color: "var(--color-fg-ink-muted)" }}>Profile</div>
                  <div className="mt-2 font-black" style={{ color: "var(--color-fg-ink)" }}>계정 정보</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className={`${MY_PAGE_SECTION_SHELL} mt-5 sm:mt-8`}>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,760px)_minmax(320px,420px)] lg:items-start lg:justify-center lg:gap-10 xl:gap-14">

            {/* ── Left: 선수 카드 ── */}
            <section className="w-full lg:justify-self-end">
              <SectionLabel text="Player Card" />
              <div className="flex w-full flex-col items-center">
                {canChooseCardSkin ? (
                  /* 보유 카드 2종을 한 화면에 나란히 — 리그 카드 / 챌린지 카드.
                     탭하면 저장·공유 대상이 그 카드로 바뀐다(테두리로 표시). */
                  <div
                    className="mx-auto grid w-full gap-4 sm:grid-cols-2"
                    style={{ maxWidth: playerCardDisplayWidth }}
                    role="group"
                    aria-label="보유 선수 카드"
                  >
                    {unlockedCardSkins.map((skin) => {
                      const active = cardSkinChoice === skin;
                      return (
                        <div key={skin} className="w-full">
                          <button
                            type="button"
                            onClick={() => chooseCardSkin(skin)}
                            aria-pressed={active}
                            className="block w-full rounded-2xl p-1 transition-all"
                            style={{
                              border: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                              boxShadow: active ? "var(--shadow-sm)" : "none",
                            }}
                          >
                            <div
                              ref={(el) => {
                                if (active) exportCardRef.current = el;
                              }}
                              className="w-full"
                            >
                              <PlayerCardCaptureFrame
                                player={withCardSkin(player, skin)}
                                teamLogo={team?.logo}
                                boxSize={760}
                                cardSize="export"
                                cardScale={0.69}
                                logoHeight={36}
                                displayWidth="100%"
                              />
                            </div>
                          </button>
                          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                            <span
                              className="text-sm font-bold"
                              style={{ color: "var(--color-fg-ink)" }}
                            >
                              {PLAYER_CARD_SKIN_LABELS[skin].label}
                            </span>
                            {active && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{
                                  background: "var(--primary)",
                                  color: "var(--color-fg-paper)",
                                }}
                              >
                                저장·공유 선택됨
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-0.5 text-center text-[11px] leading-tight"
                            style={{ color: "var(--color-fg-ink-muted)" }}
                          >
                            {PLAYER_CARD_SKIN_LABELS[skin].description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex w-full justify-center">
                    <div
                      ref={exportCardRef}
                      className="w-full"
                      style={{ maxWidth: playerCardDisplayWidth }}
                    >
                      <PlayerCardCaptureFrame
                        player={player}
                        teamLogo={team?.logo}
                        boxSize={760}
                        cardSize="export"
                        cardScale={0.69}
                        logoHeight={36}
                        displayWidth="100%"
                      />
                    </div>
                  </div>
                )}
                <div className="mt-4 grid w-full max-w-[760px] grid-cols-2 gap-3 sm:mt-5 sm:gap-4">
                  <button
                    onClick={handleShare}
                    disabled={sharing || saving}
                    className="min-h-[52px] min-w-0 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 sm:rounded-2xl sm:text-base"
                    style={{
                      background: "var(--color-fg-paper)",
                      border: "1px solid var(--primary)",
                      color: "var(--primary)",
                    }}
                  >
                    {sharing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {sharing ? "준비 중" : "공유하기"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || sharing}
                    className="min-h-[52px] min-w-0 flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 sm:rounded-2xl sm:text-base"
                    style={{
                      background: "var(--primary)",
                      color: "var(--color-fg-paper)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {saving
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4 sm:w-5 sm:h-5" />}
                    {saving ? "저장 중" : "저장하기"}
                  </button>
                </div>
                {canChooseCardSkin && (
                  <p className="mt-3 w-full max-w-[760px] text-center text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                    카드를 탭하면 저장·공유할 카드를 바꿀 수 있어요
                  </p>
                )}
                {shareMessage && (
                  <p className="mt-3 w-full max-w-[760px] text-center text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                    {shareMessage}
                  </p>
                )}
              </div>
            </section>

            {/* ── Right: 액션 + 개인 기록 ── */}
            <section className="w-full min-w-0 space-y-6 lg:sticky lg:top-24">
              <div>
                <SectionLabel text="Actions" />
                <div className="grid gap-3 sm:gap-4">
                  <Link
                    href="/my/card-edit"
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all hover:opacity-90 sm:rounded-2xl sm:text-base"
                    style={{
                      background: "var(--color-fg-paper-3)",
                      border: "1px solid var(--color-fg-blue-soft)",
                      color: "var(--primary)",
                    }}
                  >
                    <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                    카드 수정
                  </Link>
                </div>
              </div>

              <div className="flex min-w-0 flex-col">
              <SectionLabel text="Stats" />
              <div className="grid grid-cols-2 md:grid-cols-2 md:grid-rows-2 gap-3 mb-3 md:flex-1">
                <StatBox value={player.stats.goals} label="골"
                  icon={<Target className="w-4 h-4" />} />
                <StatBox value={player.stats.assists} label="어시스트"
                  icon={<Handshake className="w-4 h-4" />} />
                <StatBox value={player.stats.games} label="경기"
                  icon={<Gamepad2 className="w-4 h-4" />} />
                <StatBox value={player.stats.mom} label="MOM"
                  icon={<Star className="w-4 h-4" />} />
              </div>
              {/* Rating bar */}
              <div
                className="rounded-2xl px-5 py-4 flex items-center justify-between"
                style={{
                  background: "var(--primary)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[2px] mb-0.5"
                    style={{ fontFamily: "var(--font-space-mono)", color: "var(--color-fg-blue-soft)" }}
                  >
                    Overall Rating
                  </p>
                  <div className="flex items-end gap-1">
                    <span
                      className="font-black text-4xl tabular-nums leading-none"
                      style={{ fontFamily: "var(--font-pretendard)", color: "var(--color-fg-paper)" }}
                    >
                      {player.cardRating}
                    </span>
                    <span className="text-xs mb-1" style={{ color: "var(--color-fg-blue-soft)" }}>/100</span>
                  </div>
                </div>
                {/* Mini rating bar */}
                <div
                  className="w-28 h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.25)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${player.cardRating}%`, background: "var(--color-fg-paper)" }}
                  />
                </div>
              </div>

              {/* 다음 등급 진행률 */}
              <div className="mt-4">
                <CardProgress rating={player.cardRating} stats={player.stats} />
              </div>

              {/* 연속 출전 streak */}
              {((player.attendanceStreak ?? 0) > 0 || (player.attendanceStreakBest ?? 0) > 0) && (
                <div
                  className="mt-3 rounded-xl border p-4 flex items-center justify-between"
                  style={{
                    borderColor: "var(--color-fg-line-soft)",
                    background: "var(--color-fg-paper)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                      style={{ background: "color-mix(in srgb, #FF6B35 14%, transparent)" }}
                    >
                      🔥
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[2px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                        Streak
                      </div>
                      <div className="font-black text-xl" style={{ color: "var(--color-fg-ink)" }}>
                        {player.attendanceStreak ?? 0}경기 연속
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-[2px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                      Best
                    </div>
                    <div className="font-bold text-sm tabular-nums" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {player.attendanceStreakBest ?? 0}
                    </div>
                  </div>
                </div>
              )}
              </div>

            </section>

          </div>
        </div>
        )
      ) : (
        <div className={`${MY_PAGE_SECTION_SHELL} mt-8`}>
          <section>
            <SectionLabel text="Player Card" />
            <div
              className="rounded-2xl p-8 text-center"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px dashed var(--color-fg-line-soft)",
              }}
            >
              <div
                className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{
                  background: "var(--color-fg-paper-3)",
                  border: "1px solid var(--color-fg-blue-soft)",
                }}
              >
                <CreditCard className="w-6 h-6" style={{ color: "var(--primary)" }} />
              </div>
              <p className="font-bold text-sm mb-1" style={{ color: "var(--color-fg-ink)" }}>아직 시작 전이에요</p>
              <p className="text-sm mb-5" style={{ color: "var(--color-fg-ink-muted)" }}>
                감독 또는 선수로 시작하면 마이페이지가 활성화됩니다
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/onboarding"
                  className="inline-flex justify-center px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  style={{
                    background: "var(--primary)",
                    color: "var(--color-fg-paper)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  시작하기
                </Link>
                <Link
                  href="/my/team"
                  className="inline-flex justify-center px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  style={{
                    background: "var(--color-fg-paper)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                  }}
                >
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
          <div className={`${MY_PAGE_SECTION_SHELL} mt-16 sm:mt-20`}>
            <SectionLabel text="Next Badges" />
            <div
              className="rounded-2xl px-5 py-5 sm:px-7 md:px-8"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-14 lg:gap-x-20">
                {goals.map((goal) => (
                  <div key={goal.badge.id} className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: "var(--color-fg-paper-3)",
                        border: "1px solid var(--color-fg-blue-soft)",
                      }}
                    >
                      <img src={goal.badge.imageUrl} alt={goal.badge.name} className="w-10 h-10 object-contain" draggable={false} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm" style={{ color: "var(--color-fg-ink)" }}>
                          {goal.badge.name}
                        </span>
                        <span
                          className="text-xs tabular-nums font-bold"
                          style={{ fontFamily: "var(--font-pretendard)", color: "var(--primary)" }}
                        >
                          {goal.current}/{goal.max}
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--color-fg-paper-3)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round(goal.pct * 100)}%`, background: "var(--primary)" }}
                        />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "var(--color-fg-ink-muted)" }}>
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

      {/* ── 내 배지 진입 카드 ── */}
      {player && (
        <div className={`${MY_PAGE_SECTION_SHELL} mt-10`}>
          <SectionLabel text="Badges" />
          <Link
            href="/my/badges"
            aria-label={`내 배지 인벤토리 — 장착 ${(player.badges ?? []).length}/4`}
          >
            <div
              className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:opacity-80"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--color-fg-paper-3)",
                  border: "1px solid var(--color-fg-blue-soft)",
                }}
              >
                <Award className="w-5 h-5" style={{ color: "var(--primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm mb-0.5" style={{ color: "var(--color-fg-ink)" }}>
                  내 배지
                </p>
                <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                  획득한 배지 · 카드에 표시할 배지 {(player.badges ?? []).length}/4 장착
                </p>
              </div>
              <ChevronRight
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "var(--color-fg-ink-muted)" }}
              />
            </div>
          </Link>
        </div>
      )}

      {/* ── Team + Profile Row ── */}
      <div className={`${MY_PAGE_SECTION_SHELL} mt-10`}>
        <div className="flex flex-col md:flex-row gap-8 md:items-stretch">

          {/* ── Left: 팀 정보 ── */}
          <section className="flex-1 min-w-0">
            <SectionLabel text="Team" />
            {managedTeamId ? (
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: "var(--color-fg-paper)",
                    border: "1px solid var(--color-fg-line-soft)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Link href={player?.teamId ? `/teams/${player.teamId}` : "/my/team"} className="flex items-center gap-4 transition-all hover:opacity-80">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: "var(--color-fg-paper-3)",
                        border: "1px solid var(--color-fg-blue-soft)",
                      }}
                    >
                      <Users className="w-5 h-5" style={{ color: "var(--primary)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm mb-0.5 truncate" style={{ color: "var(--color-fg-ink)" }}>
                        {team?.name || "소속 팀"}
                      </p>
                      <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                        팀 로스터 · 시즌 기록 · 팀 게시판
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--color-fg-ink-muted)" }} />
                  </Link>
                  {/* Action row — 팀 운영은 승인된 감독/매니저에게만 노출한다. */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {player?.teamId ? (
                      <>
                        <Link
                          href={`/teams/${player.teamId}`}
                          className={`${canManageCurrentTeam ? "" : "col-span-2"} inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-xs font-bold transition-all hover:bg-[rgba(0,71,171,0.06)]`}
                          style={{
                            borderColor: "rgba(0,71,171,0.20)",
                            color: "var(--primary)",
                            background: "var(--color-fg-paper)",
                          }}
                        >
                          <Users className="h-4 w-4" />
                          팀 홈페이지
                        </Link>
                        {canManageCurrentTeam && (
                          <Link
                            href={`/teams/${player.teamId}/admin`}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold transition-all hover:opacity-90"
                            style={{
                              background: "var(--primary)",
                              color: "var(--color-fg-paper)",
                            }}
                          >
                            <Shield className="h-4 w-4" />
                            팀 운영
                          </Link>
                        )}
                        {isPendingTeamMember && (
                          <p className="col-span-2 text-center text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                            팀 승인 완료 후 팀 운영을 사용할 수 있습니다.
                          </p>
                        )}
                      </>
                    ) : (
                      <Link
                        href="/my/team"
                        className="col-span-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all hover:opacity-90"
                        style={{
                          background: "var(--primary)",
                          color: "var(--color-fg-paper)",
                        }}
                      >
                        <Shield className="h-4 w-4" />
                        팀 등록 / 가입
                      </Link>
                    )}
                  </div>
                </div>
            ) : (
              <div
                className="rounded-2xl p-5 text-center"
                style={{
                  background: "var(--color-fg-paper)",
                  border: "1px dashed var(--color-fg-line-soft)",
                }}
              >
                <p className="text-sm mb-4" style={{ color: "var(--color-fg-ink-muted)" }}>소속 팀이 없습니다</p>
                <Link
                  href="/my/team"
                  className="inline-flex px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                  style={{
                    background: "var(--color-fg-paper)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                  }}
                >
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
                  style={{
                    background: "var(--color-fg-paper)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  개인정보 수정
                </button>
              )}
            </div>
            <div
              className="rounded-2xl px-5"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {player && (
                <div
                  className="py-5"
                  style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <PlayerProfilePhoto
                        src={profilePhotoPreview || getPlayerProfilePhotoUrl(player)}
                        alt={player.name}
                        className="h-20 w-20 rounded-2xl"
                        icon={UserRound}
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={labelStyleMono}>
                          프로필 이미지
                        </div>
                        <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                          {player.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <input
                        ref={profilePhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfilePhotoChange}
                      />
                      <button
                        type="button"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={profilePhotoSaving}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                        style={{
                          background: "var(--color-fg-paper)",
                          border: "1px solid var(--primary)",
                          color: "var(--primary)",
                        }}
                      >
                        {profilePhotoSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        이미지 변경
                      </button>
                    </div>
                  </div>
                  {profilePhotoMessage && (
                    <p
                      className="mt-3 text-sm"
                      style={{
                        color: profilePhotoMessage.includes("실패")
                          ? "var(--destructive)"
                          : "var(--primary)",
                      }}
                      role="status"
                      aria-live="polite"
                    >
                      {profilePhotoMessage}
                    </p>
                  )}
                </div>
              )}
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
                      <InfoRow icon={<Shield className="w-4 h-4" />} label="참가 자격"
                        value={player.hasPlayerExperience ? "선출 (출전 불가)" : "비선출"} />
                      <InfoRow icon={<Shield className="w-4 h-4" />} label="포지션"
                        value={POSITION_LABELS[player.position] || player.position} />
                      <InfoRow icon={<Flag className="w-4 h-4" />} label="국적"
                        value={player.nationality} />
                      <InfoRow icon={<Brain className="w-4 h-4" />} label="MBTI"
                        value={player.mbti || "미입력"} />
                      {(player.disposition || player.personalValues) && (
                        <div
                          className="py-3.5 space-y-2"
                          style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {player.disposition && (
                              <span
                                className="text-[11px] px-2.5 py-1 rounded-full font-bold"
                                style={{
                                  background: "var(--color-fg-paper-3)",
                                  color: "var(--color-fg-blue-deep)",
                                  border: "1px solid var(--color-fg-blue-soft)",
                                  fontFamily: "var(--font-space-mono)",
                                }}
                              >
                                성향 · {player.disposition}
                              </span>
                            )}
                          </div>
                          {player.personalValues && (
                            <div>
                              <div className="text-[10px] uppercase tracking-wider mb-1" style={labelStyleMono}>가치관</div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-fg-ink)" }}>
                                {player.personalValues}
                              </p>
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
                    <label htmlFor="my-name" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>이름</label>
                    <input
                      id="my-name"
                      value={profileForm.name}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="my-email" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>연락 이메일</label>
                    <input
                      id="my-email"
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="my-phone" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>전화번호</label>
                    <input
                      id="my-phone"
                      type="tel"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="my-gender" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>성별</label>
                      <select
                        id="my-gender"
                        value={profileForm.gender}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, gender: event.target.value as Gender | "" }))}
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={inputStyle}
                      >
                        <option value="">선택</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                        <option value="other">기타</option>
                        <option value="prefer_not_to_say">응답 안 함</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="my-birth" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>생년월일</label>
                      <input
                        id="my-birth"
                        type="date"
                        value={profileForm.birthDate}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, birthDate: event.target.value }))}
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, hasPlayerExperience: true }))}
                      aria-pressed={profileForm.hasPlayerExperience}
                      className="rounded-xl py-2.5 text-sm font-bold transition-all"
                      style={{
                        background: profileForm.hasPlayerExperience ? "var(--primary)" : "var(--color-fg-paper)",
                        color: profileForm.hasPlayerExperience ? "var(--color-fg-paper)" : "var(--color-fg-ink)",
                        border: `1px solid ${
                          profileForm.hasPlayerExperience ? "var(--primary)" : "var(--color-fg-line-soft)"
                        }`,
                      }}
                    >
                      선출
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileForm((prev) => ({ ...prev, hasPlayerExperience: false }))}
                      aria-pressed={!profileForm.hasPlayerExperience}
                      className="rounded-xl py-2.5 text-sm font-bold transition-all"
                      style={{
                        background: !profileForm.hasPlayerExperience ? "var(--primary)" : "var(--color-fg-paper)",
                        color: !profileForm.hasPlayerExperience ? "var(--color-fg-paper)" : "var(--color-fg-ink)",
                        border: `1px solid ${
                          !profileForm.hasPlayerExperience ? "var(--primary)" : "var(--color-fg-line-soft)"
                        }`,
                      }}
                    >
                      비선출
                    </button>
                  </div>

                  {/* ── 신규 프로필 필드 ── */}
                  <div className="space-y-1.5">
                    <label htmlFor="my-mbti" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>MBTI</label>
                    <select
                      id="my-mbti"
                      value={profileForm.mbti}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, mbti: event.target.value }))}
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={inputStyle}
                    >
                      <option value="">선택 안 함</option>
                      {MBTI_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-disposition" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>성향</label>
                    <input
                      id="my-disposition"
                      type="text"
                      placeholder="예: 적극적 / 분석적 / 협동적"
                      value={profileForm.disposition}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, disposition: event.target.value }))}
                      maxLength={200}
                      aria-describedby="my-disposition-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                      style={inputStyle}
                    />
                    <p id="my-disposition-help" className="text-[10px] pl-1" style={labelStyleMono}>
                      한 줄 · 최대 200자 ({profileForm.disposition.length}/200)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-values" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>추구하는 가치관</label>
                    <textarea
                      id="my-values"
                      rows={3}
                      placeholder="내가 그라운드에서 중요하게 여기는 것"
                      value={profileForm.personalValues}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, personalValues: event.target.value }))}
                      maxLength={500}
                      aria-describedby="my-values-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                      style={inputStyle}
                    />
                    <p id="my-values-help" className="text-[10px] pl-1" style={labelStyleMono}>
                      최대 500자 ({profileForm.personalValues.length}/500)
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="my-bio" className="text-[10px] uppercase tracking-wider" style={labelStyleMono}>자기소개</label>
                    <textarea
                      id="my-bio"
                      rows={5}
                      placeholder="내 플레이 스타일·강점·연락처 등을 자유롭게 — 팀 영입 안내에 사용됩니다"
                      value={profileForm.bio}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
                      maxLength={2000}
                      aria-describedby="my-bio-help"
                      className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
                      style={inputStyle}
                    />
                    <p id="my-bio-help" className="text-[10px] pl-1" style={labelStyleMono}>
                      최대 2000자 ({profileForm.bio.length}/2000)
                    </p>
                  </div>

                  {profileMessage && (
                    <p
                      className="text-sm"
                      style={{ color: profileMessage.includes("저장") ? "var(--primary)" : "var(--destructive)" }}
                      role="status"
                      aria-live="polite"
                    >
                      {profileMessage}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={cancelProfileEdit}
                      disabled={profileSaving}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold"
                      style={{
                        background: "var(--color-fg-paper)",
                        border: "1px solid var(--color-fg-line-soft)",
                        color: "var(--color-fg-ink)",
                      }}
                    >
                      <X className="h-4 w-4" /> 취소
                    </button>
                    <button
                      type="button"
                      onClick={handleProfileSave}
                      disabled={profileSaving}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{
                        background: "var(--primary)",
                        color: "var(--color-fg-paper)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!editingProfile && profileMessage && (
              <p
                className="mt-2 text-sm"
                style={{ color: profileMessage.includes("저장") ? "var(--primary)" : "var(--destructive)" }}
                role="status"
                aria-live="polite"
              >
                {profileMessage}
              </p>
            )}
          </section>

        </div>
      </div>

      {/* ── 자기소개 (bio) ── */}
      {player?.bio && !editingProfile && (
        <div className={`${MY_PAGE_SECTION_SHELL} mt-10`}>
          <SectionLabel text="About Me" />
          <div
            className="rounded-2xl px-5 py-5"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-fg-ink)" }}>
              {player.bio}
            </p>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className={`${MY_PAGE_SECTION_SHELL} pb-16 mt-10`}>

        {/* ── 관리자/심판 운영 진입 ── */}
        {showAdminEntry && (
          <Link
            href="/admin"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all hover:opacity-90"
            style={{
              background: "var(--primary)",
              color: "var(--color-fg-paper)",
              boxShadow: "var(--shadow-sm)",
            }}
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
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--destructive)",
              color: "var(--destructive)",
            }}
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        )}

      </div>
    </div>
  );
}
