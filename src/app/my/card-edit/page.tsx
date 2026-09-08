"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, Camera, X, Loader2 } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useSubmission } from "@/hooks/useSubmission";
import { photoDraftToBlob, readPhotoFile, registrationError } from "@/lib/registration/reliability";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { COUNTRIES } from "@/constants/countries";
import { BADGES } from "@/constants/badges";
import { PlayerCard } from "@/components/player-card";
import { compressImageBlob, removeBackgroundAndCompress } from "@/lib/image-compression";
import { composeTeamlessPoseCardPhoto } from "@/lib/player-card-photo-composer";
import { isHologramPlayerCard } from "@/lib/player-card-skin";
import { DEFAULT_CARD_PHOTO_SCALE, getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";
import { FAIRGROUND_OPS_TEAM_LOGO } from "@/lib/team-logo-assets";
import { PUBLIC_PAGE_CONTENT_CLASS, PUBLIC_PAGE_GUTTER_CLASS } from "@/lib/page-layout";
import type { Position, Player } from "@/types";

/* ===========================================================
 * Light theme (White&Blue) — FairGround BrandKit 2026
 * 페이지 셸/폼/버튼만 라이트. player-card 컴포넌트 미터치.
 * =========================================================== */

const POSITIONS: { value: Position; label: string; desc: string }[] = [
  { value: "GK",   label: "GK",   desc: "골레이루 · 골키퍼" },
  { value: "FIXO", label: "FIXO", desc: "픽소 · 수비형 미드필더" },
  { value: "ALA",  label: "ALA",  desc: "알라 · 윙어" },
  { value: "PIVO", label: "PIVO", desc: "피보 · 공격수" },
];

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] uppercase tracking-[2px] mb-2 font-medium"
      style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-fg-paper)",
  border: "1px solid var(--color-fg-line-soft)",
  color: "var(--color-fg-ink)",
};

function filterEarnedBadgeIds(badgeIds: string[], earnedBadgeIds: Set<string> | null): string[] {
  if (!earnedBadgeIds) return [];
  return badgeIds.filter((id) => earnedBadgeIds.has(id)).slice(0, 4);
}

export default function CardEditPage() {
  const router = useRouter();
  const { user, player, loading, error, clearError, updatePlayer, leaveTeam, uploadPlayerPhoto, initialized } = useAuth();
  const { teams, fetchTeams, fetchMyBadges } = useDataStore();

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [teamId, setTeamId] = useState("");
  const [formError, setFormError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [nationality, setNationality] = useState("KOR");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cardPhotoPreview, setCardPhotoPreview] = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [photoScale, setPhotoScale] = useState(DEFAULT_CARD_PHOTO_SCALE);
  const [badges, setBadges] = useState<string[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string> | null>(null);
  const [done, setDone] = useState(false);
  const submission = useSubmission();
  const [photoDraft, setPhotoDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScale = useRef(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartScale = useRef(1);

  const seededPlayerRef = useRef<string | null>(null);
  // Initialize once; token refresh must not erase an in-progress edit.
  useEffect(() => {
    if (player && seededPlayerRef.current !== player.id) {
      seededPlayerRef.current = player.id;
      setName(player.name);
      setNumber(String(player.number));
      setPosition(player.position);
      setTeamId(player.teamId || "");
      setNationality(player.nationality || "KOR");
      setPhotoScale(player.photoScale ?? DEFAULT_CARD_PHOTO_SCALE);
      setBadges(player.badges ?? []);
    }
  }, [player]);

  const draft = useFormDraft(user && !done ? `card-edit:${user.uid}` : null,
    { name, number, position, nationality, photoScale, photoDraft, badges }, (d) => {
      setName(d.name); setNumber(d.number); setPosition(d.position); setNationality(d.nationality);
      setPhotoScale(d.photoScale); setPhotoDraft(d.photoDraft);
      if (d.photoDraft) {
        setPhotoBlob(photoDraftToBlob(d.photoDraft)); setPhotoPreview(d.photoDraft); setCardPhotoPreview(d.photoDraft);
      }
      setBadges(d.badges);
    });

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  useEffect(() => {
    if (!player?.id) {
      setEarnedBadgeIds(null);
      setBadges([]);
      return;
    }

    let cancelled = false;
    setEarnedBadgeIds(null);
    (async () => {
      const rows = await fetchMyBadges(player.id);
      if (cancelled) return;
      const earned = new Set(rows.filter((row) => row.isEarned).map((row) => row.badgeId));
      setEarnedBadgeIds(earned);
      setBadges((prev) => filterEarnedBadgeIds(prev, earned));
    })();

    return () => {
      cancelled = true;
    };
  }, [player?.id, fetchMyBadges]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) { router.replace("/login?returnTo=%2Fmy%2Fcard-edit"); return; }
    if (initialized && user && !player) { router.replace("/my/player-setup"); return; }
  }, [initialized, user, player, router]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy = e.clientY - dragStartY.current;
      setPhotoScale(Math.min(2.5, Math.max(0.5, dragStartScale.current - dy * 0.005)));
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    const hasPhoto = !!(cardPhotoPreview || photoPreview || player?.photoUrl);
    if (!el || !hasPhoto) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setPhotoScale(s => Math.min(2.5, Math.max(0.5, s - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [cardPhotoPreview, photoPreview, player?.photoUrl]);

  const shouldUseTeamlessPose = (nextTeamId: string) => {
    return player?.role !== "referee" && (isHologramPlayerCard(player) || !nextTeamId);
  };

  const buildCardPhotoBlob = async (
    nextTeamId: string,
    sourceBlob: Blob,
    cutoutBlob: Blob,
  ) => {
    if (!shouldUseTeamlessPose(nextTeamId)) return cutoutBlob;
    try {
      return await composeTeamlessPoseCardPhoto({
        sourcePhoto: sourceBlob,
        cutoutPhoto: cutoutBlob,
        gender: player?.gender,
        seed: `${player?.uid ?? user?.uid ?? ""}-${name}-${number}`,
      });
    } catch (error) {
      console.error("[CardEdit] teamless pose composition failed:", error);
      return cutoutBlob;
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || bgProcessing) return;
    setBgProcessing(true);
    setFormError("");
    try {

    const compressed = await compressImageBlob(file, {
      maxPx: 1400,
      mimeType: "image/webp",
      quality: 0.9,
    });
    const compressedPreviewUrl = URL.createObjectURL(compressed);
    setPhotoPreview(compressedPreviewUrl);
    setCardPhotoPreview(null);
    setPhotoBlob(compressed);

    setBgProcessing(true);
    try {
      let optimizedPhoto = compressed;
      try {
        optimizedPhoto = await removeBackgroundAndCompress(compressed, {
          maxPx: 1400,
          mimeType: "image/webp",
          quality: 0.92,
        });
      } catch (error) {
        console.error("[CardEdit] background removal failed:", error);
      }
      const finalPhoto = await buildCardPhotoBlob(teamId, compressed, optimizedPhoto);
      setPhotoPreview(URL.createObjectURL(finalPhoto));
      setCardPhotoPreview(URL.createObjectURL(finalPhoto));
      setPhotoBlob(finalPhoto);
      URL.revokeObjectURL(compressedPreviewUrl);
    } finally {
      setBgProcessing(false);
    }
    } catch (e) {
      setFormError(registrationError(e, "사진을 처리하지 못했습니다. 다른 이미지로 다시 선택해주세요."));
    } finally { setBgProcessing(false); }
  };

  const handleRemovePhoto = () => {
    setPhotoBlob(null);
    setPhotoDraft("");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);
    setPhotoPreview(null);
    setCardPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 팀 탈퇴 — 소속 변경의 유일한 출구. 서버(leave_team RPC)가 팀 대표는 거부한다.
  const handleLeaveTeam = async () => {
    if (!selectedTeam) return;
    if (!confirm(`${selectedTeam.name}에서 탈퇴할까요?\n\n무소속이 되고, 다른 팀 홈에서 다시 가입 신청할 수 있습니다.`)) return;
    clearError();
    setFormError("");
    setLeaving(true);
    try {
      await leaveTeam();
      setTeamId("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "탈퇴에 실패했습니다.");
    } finally {
      setLeaving(false);
    }
  };

  useEffect(() => {
    if (!photoBlob) return;
    let cancelled = false;
    void readPhotoFile(photoBlob).then((value) => { if (!cancelled) setPhotoDraft(value); })
      .catch((e) => { if (!cancelled) setFormError(registrationError(e)); });
    return () => { cancelled = true; };
  }, [photoBlob]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setFormError("");
    if (!name.trim() || !position || !/^[1-9]\d?$/.test(number)) {
      setFormError("이름, 포지션, 등번호(1~99)를 확인해주세요."); return;
    }
    if (!earnedBadgeIds) { setFormError("배지 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return; }
    if (bgProcessing || !draft.ready || !submission.begin()) return;
    const equippedEarnedBadges = filterEarnedBadgeIds(badges, earnedBadgeIds);
    try {
      const updates: Partial<Player> = {
        name: name.trim(),
        number: parseInt(number, 10),
        position: position as Position,
        nationality,
        photoScale,
        badges: equippedEarnedBadges,
      };

      // 새 사진이 있으면 업로드
      if (photoBlob) {
        const photoFile = new File([photoBlob], "photo.webp", {
          type: photoBlob.type || "image/webp",
        });
        const uploadedPhotoUrl = await uploadPlayerPhoto(photoFile);
        updates.photoUrl = uploadedPhotoUrl;
        if (!player?.profilePhotoLocked) {
          updates.profilePhotoUrl = uploadedPhotoUrl;
          updates.profilePhotoLocked = false;
        }
      }

      await updatePlayer(updates);
      draft.clear();
      setDone(true);
      setTimeout(() => router.push("/my"), 1500);
    } catch (err) {
      // 저장 실패를 삼키면 버튼이 "아무 반응 없음"으로 보인다. 스토어가 못 잡는
      // 클라이언트측 검증 실패(예: 자기수정 금지 필드)도 여기서 화면에 띄운다.
      setFormError(registrationError(err));
    } finally { submission.end(); }
  };

  if (!initialized || (initialized && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-fg-paper)" }}>
        <div
          className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--color-fg-paper)" }}
      >
        <div className="text-center space-y-5">
          <div
            className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
            style={{
              background: "var(--color-fg-paper-3)",
              border: "2px solid var(--color-fg-blue-soft)",
            }}
          >
            <CheckCircle className="w-9 h-9" style={{ color: "var(--primary)" }} />
          </div>
          <h2
            className="font-black text-2xl"
            style={{
              fontFamily: "var(--font-pretendard)",
              letterSpacing: "-1px",
              color: "var(--color-fg-ink)",
            }}
          >
            카드 수정 완료!
          </h2>
        </div>
      </div>
    );
  }

  const currentCardPhoto = cardPhotoPreview || photoPreview || player?.photoUrl || "";
  const currentThumbPhoto = photoPreview || getPlayerProfilePhotoUrl(player);
  const hasCustomCardPhoto = Boolean(currentCardPhoto);

  const selectedTeam = teamId ? teams[teamId] : undefined;
  const fallbackTeamLogo =
    player?.role === "admin" || player?.role === "referee" ? FAIRGROUND_OPS_TEAM_LOGO : undefined;
  const previewTeamLogo = selectedTeam?.logo || fallbackTeamLogo;
  const selectedEarnedBadges = filterEarnedBadgeIds(badges, earnedBadgeIds);
  const earnedBadgeOptions = earnedBadgeIds
    ? BADGES.filter((badge) => {
        if (!earnedBadgeIds.has(badge.id)) return false;
        if (position === "GK") return badge.category === "field" || badge.category === "goalkeeper";
        if (player?.role === "referee") return badge.category === "referee";
        return badge.category === "field";
      })
    : [];

  const previewPlayer: Player = {
    id: "preview",
    uid: "preview",
    name: name.trim() || "이름",
    number: parseInt(number, 10) || 10,
    position: (position as Position) || "ALA",
    teamId: teamId || "",
    nationality: nationality || "KOR",
    photoUrl: currentCardPhoto,
    photoScale,
    cardType: player?.cardType ?? "gold",
    cardSkin: player?.cardSkin ?? "standard",
    cardRating: player?.cardRating ?? 70,
    stats: player?.stats ?? { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: selectedEarnedBadges,
    penaltyStatus: player?.penaltyStatus ?? { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: player?.isApproved ?? false,
    role: player?.role ?? "player",
    createdAt: player?.createdAt ?? Date.now(),
  };

  return (
    <div className="min-h-screen pt-[60px]" style={{ background: "var(--color-fg-paper)" }}>

      {/* 배경제거 토스트 */}
      {bgProcessing && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            boxShadow: "var(--shadow-lg)",
          }}
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "var(--primary)" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>배경 제거 중...</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-ink-muted)" }}>잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={PUBLIC_PAGE_GUTTER_CLASS}>
        <div
          className={`${PUBLIC_PAGE_CONTENT_CLASS} pt-8 pb-6`}
          style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
        >
          <h1
            className="font-black text-3xl leading-tight"
            style={{
              fontFamily: "var(--font-pretendard)",
              letterSpacing: "-1.5px",
              color: "var(--color-fg-ink)",
            }}
          >
            카드 수정
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--color-fg-ink-muted)" }}>
            선수 카드 정보를 수정하세요
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`${PUBLIC_PAGE_GUTTER_CLASS} py-8`}>
        {draft.message && <p role="status" className="text-sm md:col-span-2">{draft.message}</p>}
        <fieldset disabled={submission.submitting || bgProcessing || !draft.ready} className="contents">

        <div className={`${PUBLIC_PAGE_CONTENT_CLASS} space-y-6`}>

        {/* 카드 미리보기 + 사진 업로드 */}
        <div className="mx-auto grid max-w-[640px] gap-8 py-2 md:grid-cols-[minmax(0,280px)_minmax(0,280px)] md:items-start md:justify-center md:gap-10">
          <section aria-label="선수 카드 미리보기" className="flex w-full max-w-[280px] min-w-0 flex-col items-center justify-self-center">
            <div className="mb-4 w-full max-w-[220px]">
              <p
                className="text-[10px] uppercase tracking-[2px]"
                style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
              >
                카드 미리보기
              </p>
              <h2
                className="mt-1 text-lg font-black"
                style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-pretendard)" }}
              >
                현재 선수 카드
              </h2>
            </div>

            <div
              ref={overlayRef}
              className="relative flex w-full touch-none select-none justify-center"
              style={{ cursor: hasCustomCardPhoto ? "ns-resize" : "default" }}
              onMouseDown={(e) => {
                if (!hasCustomCardPhoto) return;
                e.preventDefault();
                dragging.current = true;
                dragStartY.current = e.clientY;
                dragStartScale.current = photoScale;
              }}
              onTouchStart={(e) => {
                if (!hasCustomCardPhoto) return;
                touchStartY.current = e.touches[0].clientY;
                touchStartScale.current = photoScale;
              }}
              onTouchMove={(e) => {
                if (!hasCustomCardPhoto) return;
                e.preventDefault();
                const dy = e.touches[0].clientY - touchStartY.current;
                setPhotoScale(Math.min(2.5, Math.max(0.5, touchStartScale.current - dy * 0.005)));
              }}
            >
              <PlayerCard
                player={previewPlayer}
                size="lg"
                teamLogo={previewTeamLogo}
                disableHoverScale
              />
            </div>
          </section>

          {/* 사진 업로드 */}
          <section aria-label="프로필 사진 첨부" className="flex w-full max-w-[280px] min-w-0 flex-col items-center justify-self-center">
            <div className="mb-4 w-full max-w-[184px]">
              <p
                className="text-[10px] uppercase tracking-[2px]"
                style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
              >
                프로필 사진
              </p>
              <h2
                className="mt-1 text-lg font-black"
                style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-pretendard)" }}
              >
                사진 첨부
              </h2>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div className="flex w-full max-w-[280px] justify-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="프로필 사진 업로드"
                  className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-[28px] transition-all hover:opacity-80 sm:h-44 sm:w-44 md:h-[184px] md:w-[184px]"
                  style={{
                    background: currentThumbPhoto ? "transparent" : "var(--color-fg-paper-2)",
                    border: currentThumbPhoto
                      ? "2px solid var(--primary)"
                      : "2px dashed var(--color-fg-line-soft)",
                  }}
                >
                  {currentThumbPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentThumbPhoto} alt="preview" className="h-full w-full object-contain object-center" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-7 w-7" style={{ color: "var(--color-fg-ink-muted)" }} />
                      <span
                        className="text-[10px] uppercase tracking-wider text-center"
                        style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
                      >
                        사진 추가
                      </span>
                    </div>
                  )}
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    aria-label="사진 제거"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "var(--destructive)" }}
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            </div>
            {currentCardPhoto && (
              <div className="mt-3 flex w-full max-w-[280px] flex-col items-center gap-2">
                <p className="text-[10px] text-center leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                  탭하여 변경<br />
                  카드 미리보기를 위아래로 드래그하면 사진 크기가 조절됩니다
                </p>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{
                    background: "var(--color-fg-paper-2)",
                    border: "1px solid var(--color-fg-line-soft)",
                  }}
                >
                  <span style={{ color: "var(--color-fg-ink-muted)", fontSize: 11, fontFamily: "monospace" }}>↕</span>
                  <span
                    className="font-black tabular-nums"
                    style={{ color: "var(--color-fg-ink)", fontSize: 13, fontFamily: "var(--font-pretendard)" }}
                  >
                    {Math.round(photoScale * 100)}%
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="mx-auto max-w-lg space-y-6">

        {/* 이름 */}
        <div>
          <FieldLabel htmlFor="cardedit-name">이름</FieldLabel>
          <input
            id="cardedit-name"
            type="text"
            placeholder="선수 이름 입력"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* 등번호 */}
        <div>
          <FieldLabel htmlFor="cardedit-number">등번호</FieldLabel>
          <input
            id="cardedit-number"
            type="number"
            placeholder="1 – 99"
            min={1}
            max={99}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
            style={inputStyle}
          />
        </div>

        {/* 포지션 */}
        <div>
          <FieldLabel>포지션</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {POSITIONS.map((pos) => {
              const selected = position === pos.value;
              return (
                <button
                  key={pos.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPosition(pos.value);
                    if (pos.value !== "GK") {
                      setBadges((prev) => prev.filter((id) => {
                        const b = BADGES.find((b) => b.id === id);
                        if (!b) return false;
                        if (earnedBadgeIds && !earnedBadgeIds.has(id)) return false;
                        return b.category !== "goalkeeper";
                      }));
                    }
                  }}
                  className="text-left px-4 py-3 rounded-2xl transition-all"
                  style={{
                    background: selected ? "var(--color-fg-paper-3)" : "var(--color-fg-paper)",
                    border: `1.5px solid ${selected ? "var(--primary)" : "var(--color-fg-line-soft)"}`,
                  }}
                >
                  <div
                    className="font-black text-base leading-none mb-0.5"
                    style={{
                      fontFamily: "var(--font-pretendard)",
                      color: selected ? "var(--primary)" : "var(--color-fg-ink)",
                    }}
                  >
                    {pos.label}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>{pos.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 뱃지 선택 */}
        <div>
          <FieldLabel>뱃지 <span style={{ color: "var(--color-fg-ink-muted)" }}>({selectedEarnedBadges.length}/4)</span></FieldLabel>
          {earnedBadgeIds === null ? (
            <p className="rounded-2xl px-4 py-5 text-center text-xs" style={{ color: "var(--color-fg-ink-muted)", border: "1px dashed var(--color-fg-line-soft)" }}>
              획득한 뱃지를 확인하는 중입니다
            </p>
          ) : earnedBadgeOptions.length === 0 ? (
            <p className="rounded-2xl px-4 py-5 text-center text-xs" style={{ color: "var(--color-fg-ink-muted)", border: "1px dashed var(--color-fg-line-soft)" }}>
              아직 장착할 수 있는 획득 뱃지가 없습니다
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {earnedBadgeOptions.map((badge) => {
                const selected = selectedEarnedBadges.includes(badge.id);
                return (
                  <button
                    key={badge.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (selected) {
                        setBadges((prev) => prev.filter((id) => id !== badge.id));
                      } else if (selectedEarnedBadges.length < 4) {
                        setBadges((prev) => filterEarnedBadgeIds([...prev, badge.id], earnedBadgeIds));
                      }
                    }}
                    className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all"
                    style={{
                      background: selected ? "var(--color-fg-paper-3)" : "var(--color-fg-paper)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--color-fg-line-soft)"}`,
                      opacity: !selected && selectedEarnedBadges.length >= 4 ? 0.35 : 1,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={badge.imageUrl} alt={badge.name}
                      className="object-contain" draggable={false}
                      style={{ width: 56, height: 56 }} />
                    <span
                      className="text-[10px] leading-tight text-center truncate w-full"
                      style={{ color: selected ? "var(--primary)" : "var(--color-fg-ink-muted)" }}
                    >
                      {badge.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 팀 — 소속은 가입 신청 절차로만 바뀐다. DB 트리거가 직접 수정을 거부하므로
            여기서 고를 수 있게 두면 저장이 조용히 실패한다(읽기 전용). */}
        <div>
          <FieldLabel htmlFor="cardedit-team">팀</FieldLabel>
          <div
            id="cardedit-team"
            className="w-full px-4 py-3 rounded-2xl text-sm flex items-center justify-between gap-3"
            style={inputStyle}
          >
            <span style={{ color: selectedTeam ? "var(--color-fg-ink)" : "var(--color-fg-ink-muted)" }}>
              {selectedTeam?.name ?? "무소속"}
            </span>
            {selectedTeam ? (
              <button
                type="button"
                onClick={() => void handleLeaveTeam()}
                disabled={leaving}
                className="whitespace-nowrap text-xs font-bold disabled:opacity-40"
                style={{ color: "var(--destructive)" }}
              >
                {leaving ? "탈퇴 중…" : "팀 탈퇴"}
              </button>
            ) : (
              <Link
                href="/teams"
                className="whitespace-nowrap text-xs font-bold"
                style={{ color: "var(--primary)" }}
              >
                팀 찾아 가입 신청 →
              </Link>
            )}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
            {selectedTeam
              ? "팀을 옮기려면 먼저 탈퇴한 뒤, 옮길 팀 홈에서 가입 신청하세요. 팀 대표는 대표를 넘긴 뒤에만 탈퇴할 수 있습니다."
              : "팀 홈에서 가입 신청하면 팀 운영진 승인 후 소속이 반영됩니다."}
          </p>
        </div>

        {/* 국적 */}
        <div>
          <FieldLabel htmlFor="cardedit-nationality">국적</FieldLabel>
          <div className="relative">
            <select
              id="cardedit-nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none appearance-none"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--color-fg-ink-muted)" }}
            />
          </div>
        </div>

        {(formError || error) && (
          <p
            className="text-sm px-1"
            style={{ color: "var(--destructive)" }}
            role="alert"
            aria-live="polite"
          >
            {formError || error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || submission.submitting || bgProcessing || !draft.ready || earnedBadgeIds === null}
          className="w-full py-4 rounded-2xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-30"
          style={{
            background: "var(--primary)",
            color: "var(--color-fg-paper)",
            fontFamily: "var(--font-pretendard)",
            letterSpacing: "-0.5px",
            fontSize: 15,
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {loading || submission.submitting ? "저장 중..." : "수정 저장하기"}
        </button>

        <p className="text-center text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
          <button
            type="button"
            onClick={() => router.back()}
            className="font-semibold hover:opacity-80 transition-opacity"
            style={{ color: "var(--primary)" }}
          >
            취소
          </button>
        </p>

        </div>

        </div>
      </fieldset>
      </form>
    </div>
  );
}
