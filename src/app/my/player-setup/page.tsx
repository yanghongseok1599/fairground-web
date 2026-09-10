"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ChevronDown, Camera, X, Loader2 } from "lucide-react";
import { needsKoreanNameCheck } from "@/lib/registration-profile";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useSubmission } from "@/hooks/useSubmission";
import { photoDraftToBlob, readPhotoFile, registrationError } from "@/lib/registration/reliability";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { COUNTRIES } from "@/constants/countries";
import { PlayerCard } from "@/components/player-card";
import { PlayerCardTierPreviewGrid } from "@/components/player-card-tier-preview-grid";
import { compressImageBlob, removeBackgroundAndCompress } from "@/lib/image-compression";
import { composeTeamlessPoseCardPhoto } from "@/lib/player-card-photo-composer";
import { PLAYER_CARD_FRAME } from "@/lib/player-card-frame";
import { DEFAULT_CARD_PHOTO_SCALE } from "@/lib/player-profile-photo";
import { hasCompletedPlayerCardSetup } from "@/lib/player-onboarding";
import {
  clearPendingCardSkin,
  getCardSkinFromSearchParams,
  GROUND_CHALLENGE_PLAYER_CARD_SKIN,
  readPendingCardSkin,
} from "@/lib/player-card-skin";
import type { Position, Player, PlayerCardSkin, PlayerRole } from "@/types";

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

const ROLE_OPTIONS: { value: Exclude<PlayerRole, "admin">; label: string; desc: string }[] = [
  { value: "player", label: "선수", desc: "선수 카드를 만들고 팀에 합류해 활동합니다" },
  { value: "captain", label: "감독", desc: "선수 지도와 경기 운영을 총괄합니다" },
  { value: "referee", label: "심판", desc: "승인 후 경기 운영 메뉴에 접근합니다" },
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

const PHOTO_OVERLAY = PLAYER_CARD_FRAME.pos.photo;

export default function PlayerSetupPage() {
  return (
    <Suspense fallback={<PlayerSetupFallback />}>
      <PlayerSetupContent />
    </Suspense>
  );
}

function PlayerSetupFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--color-fg-paper)" }}>
      <div
        className="h-8 w-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function PlayerSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, player, loading, error, clearError, createPlayer, uploadPlayerPhoto, initialized } = useAuth();
  const { teams, fetchTeams } = useDataStore();
  const playerSetupSearch = searchParams?.toString() ?? "";

  // /onboarding으로부터 ?role=captain|player 를 받으면 디폴트로 선택.
  // 잘못된 값은 무시하고 'player'로 폴백.
  const presetRole: Exclude<PlayerRole, "admin"> = (() => {
    const v = searchParams?.get("role");
    if (v === "captain" || v === "player" || v === "referee") return v;
    return "player";
  })();

  const [cardSkin] = useState<PlayerCardSkin>(() =>
    getCardSkinFromSearchParams(searchParams) ?? readPendingCardSkin() ?? "standard",
  );
  const isGroundChallengeCard = cardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN;
  const canContinuePlayerSetup =
    !hasCompletedPlayerCardSetup(player);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [portraitConsent, setPortraitConsent] = useState(false);
  const [role, setRole] = useState<Exclude<PlayerRole, "admin">>(presetRole);
  const [teamId, setTeamId] = useState("");
  const [nationality, setNationality] = useState("KOR");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null); // 배경제거본 저장용
  const [sourcePhotoBlob, setSourcePhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);   // 프로필 썸네일
  const [cardPhotoPreview, setCardPhotoPreview] = useState<string | null>(null); // 카드: 배경제거
  const [bgProcessing, setBgProcessing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoScale, setPhotoScale] = useState(DEFAULT_CARD_PHOTO_SCALE);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);
  const submission = useSubmission();
  const [photoDraft, setPhotoDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoRequestRef = useRef(0);

  // 카드 위 드래그로 사진 크기 조절
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScale = useRef(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartScale = useRef(1);
  const seededPlayerRef = useRef<string | null>(null);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      const returnTo = `/my/player-setup${playerSetupSearch ? `?${playerSetupSearch}` : ""}`;
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (player && !canContinuePlayerSetup && !submission.submitting && !formError && !done) {
      router.replace("/my/card-edit");
    }
  }, [initialized, user, player, router, playerSetupSearch, canContinuePlayerSetup, submission.submitting, formError, done]);

  useEffect(() => {
    if (!player || !canContinuePlayerSetup) return;
    if (seededPlayerRef.current === player.id) return;
    seededPlayerRef.current = player.id;
    const nextRole =
      player.role === "captain" || player.role === "player" || player.role === "referee"
        ? player.role
        : presetRole;
    setName((current) => current || player.name || "");
    setNumber((current) => current || (player.number > 0 ? String(player.number) : ""));
    setPosition((current) => current || player.position || "");
    setRole((current) => current || nextRole);
    setTeamId((current) => current || player.teamId || "");
    setNationality((current) => current || player.nationality || "KOR");
    setPhotoScale(player.photoScale || DEFAULT_CARD_PHOTO_SCALE);
  }, [player, canContinuePlayerSetup, presetRole]);

  const draft = useFormDraft(user && !done ? `player-setup:${user.uid}` : null,
    { name, number, position, nationality, photoScale, photoDraft, role, teamId, portraitConsent }, (d) => {
      setName(d.name); setNumber(d.number); setPosition(d.position); setNationality(d.nationality);
      setPhotoScale(d.photoScale); setPhotoDraft(d.photoDraft);
      if (d.photoDraft) {
        setPhotoBlob(photoDraftToBlob(d.photoDraft)); setPhotoPreview(d.photoDraft); setCardPhotoPreview(d.photoDraft);
      }
      setRole(d.role); setTeamId(d.teamId); setPortraitConsent(d.portraitConsent);
    });

  // 전역 마우스 이벤트 (드래그 중 커서가 벗어나도 작동)
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

  // 스크롤 휠 (passive: false 필요)
  useEffect(() => {
    const el = overlayRef.current;
    const hasCardPhoto = !!(cardPhotoPreview || photoPreview);
    if (!el || !hasCardPhoto) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setPhotoScale(s => Math.min(2.5, Math.max(0.5, s - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [cardPhotoPreview, photoPreview]);

  const shouldUseTeamlessPose = (nextTeamId: string, nextRole = role) => {
    return nextRole !== "referee" && (isGroundChallengeCard || !nextTeamId);
  };

  const buildCardPhotoBlob = async (
    nextTeamId: string,
    nextRole: Exclude<PlayerRole, "admin">,
    sourceBlob: Blob,
  ) => {
    if (shouldUseTeamlessPose(nextTeamId, nextRole)) {
      return composeTeamlessPoseCardPhoto({
        sourcePhoto: sourceBlob,
        gender: user?.gender,
        seed: `${user?.uid ?? ""}-${name}-${number}`,
      });
    }
    return removeBackgroundAndCompress(sourceBlob, { maxPx: 1400, mimeType: "image/webp", quality: 0.92 });
  };

  const setProcessedPhoto = (blob: Blob) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);
    setPhotoPreview(URL.createObjectURL(blob));
    setCardPhotoPreview(URL.createObjectURL(blob));
    setPhotoBlob(blob);
  };

  const reprocessUploadedPhoto = async (nextTeamId: string, nextRole = role) => {
    if (!sourcePhotoBlob) return;
    const requestId = ++photoRequestRef.current;
    setBgProcessing(true);
    setPhotoError("");
    setFormError("");
    try {
      const finalPhoto = await buildCardPhotoBlob(nextTeamId, nextRole, sourcePhotoBlob);
      if (requestId === photoRequestRef.current) setProcessedPhoto(finalPhoto);
    } catch (error) {
      if (requestId === photoRequestRef.current) {
        setTeamId(teamId);
        setRole(role);
        setPhotoError(registrationError(error, "사진 합성에 실패했습니다. 다른 사진으로 다시 시도해주세요."));
      }
    } finally {
      if (requestId === photoRequestRef.current) setBgProcessing(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || bgProcessing) return;
    const input = e.target;
    const requestId = ++photoRequestRef.current;
    setBgProcessing(true);
    setPhotoError("");
    setFormError("");
    try {
      const compressed = await compressImageBlob(file, { maxPx: 1400, mimeType: "image/webp", quality: 0.9 });
      const finalPhoto = await buildCardPhotoBlob(teamId, role, compressed);
      if (requestId !== photoRequestRef.current) return;
      setSourcePhotoBlob(compressed);
      setProcessedPhoto(finalPhoto);
    } catch (e) {
      if (requestId === photoRequestRef.current) setPhotoError(registrationError(e, "사진을 처리하지 못했습니다. 다른 이미지로 다시 선택해주세요."));
    } finally {
      if (requestId === photoRequestRef.current) {
        setBgProcessing(false);
        input.value = "";
      }
    }
  };

  const handleRemovePhoto = () => {
    photoRequestRef.current++;
    setBgProcessing(false);
    setPhotoError("");
    setPhotoBlob(null);
    setPhotoDraft("");
    setSourcePhotoBlob(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);
    setPhotoPreview(null);
    setCardPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTeamChange = (nextTeamId: string) => {
    if (bgProcessing) return;
    setTeamId(nextTeamId);
    void reprocessUploadedPhoto(nextTeamId, role);
  };

  const handleRoleChange = (nextRole: Exclude<PlayerRole, "admin">) => {
    if (bgProcessing) return;
    setRole(nextRole);
    void reprocessUploadedPhoto(teamId, nextRole);
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
    if (photoError) return;
    clearError();
    setFormError("");
    if (!name.trim() || !position || !/^[1-9]\d?$/.test(number)) {
      setFormError("이름, 포지션, 등번호(1~99)를 확인해주세요."); return;
    }
    if (!portraitConsent) { setFormError("촬영물 활용 동의 항목을 확인해주세요."); return; }
    if (bgProcessing || !draft.ready || !submission.begin()) return;
    try {
      let photoUrl = "";
      if (photoBlob) {
        const photoFile = new File([photoBlob], "photo.webp", {
          type: photoBlob.type || "image/webp",
        });
        photoUrl = await uploadPlayerPhoto(photoFile);
      }
      await createPlayer({
        name: name.trim(),
        number: parseInt(number, 10),
        position: position as Position,
        role,
        teamId: teamId || "",
        teamRole: role === "captain" ? "coach" : undefined,
        nationality,
        gender: user?.gender,
        photoUrl,
        profilePhotoUrl: photoUrl,
        profilePhotoLocked: false,
        photoScale,
        cardSkin,
        portraitConsentAt: Date.now(),
      });
      // Membership is a separate, recoverable request; profile writes never move a player.
      if (teamId && teamId !== player?.teamId) {
        try { await useDataStore.getState().requestJoinTeam(teamId); }
        catch (e) {
          setFormError(`선수 정보는 저장되었습니다. 팀 가입 신청은 완료하지 못했습니다. ${registrationError(e)}`);
          return;
        }
      }
      clearPendingCardSkin();
      draft.clear();
      setDone(true);
      // 가입 완료 후 마이페이지로 — 거기서 본인 카드/팀 상태를 확인할 수 있다.
      // (이전엔 /players 전체 목록으로 가서 본인 카드가 어디 있는지 모호했음)
      setTimeout(() => router.push(role === "captain" && !teamId ? "/my/team" : "/my"), 1800);
    } catch (e) {
      setFormError(registrationError(e));
    } finally { submission.end(); }
  };

  if (!initialized || !user || (player && !canContinuePlayerSetup && !submission.submitting && !formError && !done)) {
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
          <div>
            <h2
              className="font-black text-2xl mb-2"
              style={{
                fontFamily: "var(--font-pretendard)",
                letterSpacing: "-1px",
                color: "var(--color-fg-ink)",
              }}
            >
              선수 카드 생성 완료!
            </h2>
            <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
              관리자 승인 후 카드가 활성화됩니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedTeam = teamId ? teams[teamId] : undefined;
  const currentCardPhoto = cardPhotoPreview || photoPreview || "";
  const hasCustomCardPhoto = Boolean(currentCardPhoto);

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
    cardType: "gold",
    cardSkin,
    cardRating: 70,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: false,
    role,
    teamRole: role === "captain" ? "coach" : undefined,
    createdAt: Date.now(),
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
            <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>{shouldUseTeamlessPose(teamId) ? "얼굴 합성 중..." : "배경 제거 중..."}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-ink-muted)" }}>잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="px-5 pt-8 pb-6 sm:px-8 md:px-10 max-w-lg mx-auto"
        style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
      >
        <p
          className="text-[11px] uppercase tracking-[3px] mb-2"
          style={{ fontFamily: "var(--font-space-mono)", color: "var(--primary)" }}
        >
          Step 2 of 2
        </p>
        <h1
          className="font-black text-3xl leading-tight"
          style={{
            fontFamily: "var(--font-pretendard)",
            letterSpacing: "-1.5px",
            color: "var(--color-fg-ink)",
          }}
        >
          선수 카드 만들기
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--color-fg-ink-muted)" }}>
          {isGroundChallengeCard
            ? "그라운드 챌린지 한정 홀로그램 스킨이 적용됩니다"
            : "나만의 선수 카드 정보를 입력해주세요"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6 px-5 py-8 sm:px-8 md:grid md:max-w-5xl md:grid-cols-[minmax(0,460px)_320px] md:items-start md:gap-12 md:space-y-0 md:px-10">
        {draft.message && <p role="status" className="text-sm md:col-span-2">{draft.message}</p>}
        <fieldset disabled={submission.submitting || bgProcessing || !draft.ready} className="contents">


        {/* 모바일은 세로 스택, 데스크톱은 오른쪽 미리보기 컬럼. */}
        <div className="flex flex-col items-center gap-5 py-2 md:order-2 md:sticky md:top-28">

          {isGroundChallengeCard ? (
            <section className="w-full" aria-label="그라운드 챌린지 홀로그램 카드 미리보기">
              <div className="mb-3 text-center">
                <p
                  className="text-[10px] font-black uppercase tracking-[2px]"
                  style={{ color: "var(--color-fg-red)", fontFamily: "var(--font-space-mono)" }}
                >
                  MANGSANG GROUND CHALLENGE
                </p>
                <h2
                  className="mt-1 text-lg font-black"
                  style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-pretendard)" }}
                >
                  한정 홀로그램 선수카드
                </h2>
              </div>
              <div
                ref={overlayRef}
                className="relative mx-auto flex w-fit touch-none select-none justify-center"
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
                  teamLogo={selectedTeam?.logo}
                  disableHoverScale
                />
              </div>
            </section>
          ) : (
            <PlayerCardTierPreviewGrid
              player={previewPlayer}
              teamLogo={selectedTeam?.logo}
              customPhotoUrl={currentCardPhoto || undefined}
              renderPhotoOverlay={(cardType) => {
                if (cardType !== "bronze" || !hasCustomCardPhoto) return null;
                return (
                  <div
                    ref={overlayRef}
                    className="absolute select-none"
                    style={{
                      left: `${PHOTO_OVERLAY.x}%`,
                      top: `${PHOTO_OVERLAY.y}%`,
                      width: `${PHOTO_OVERLAY.w}%`,
                      height: `${PHOTO_OVERLAY.h}%`,
                      zIndex: 10,
                      cursor: "ns-resize",
                      touchAction: "none",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      dragging.current = true;
                      dragStartY.current = e.clientY;
                      dragStartScale.current = photoScale;
                    }}
                    onTouchStart={(e) => {
                      touchStartY.current = e.touches[0].clientY;
                      touchStartScale.current = photoScale;
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const dy = e.touches[0].clientY - touchStartY.current;
                      setPhotoScale(Math.min(2.5, Math.max(0.5, touchStartScale.current - dy * 0.005)));
                    }}
                  />
                );
              }}
            />
          )}

          {/* 하단: 사진 업로드 버튼 */}
          <div className="flex flex-col items-center gap-3">
            <p
              className="text-[10px] uppercase tracking-[2px] self-center"
              style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-space-mono)" }}
            >
              프로필 사진 <span style={{ color: "var(--color-fg-ink-muted)" }}>(선택)</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="프로필 사진 업로드"
                className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center transition-all hover:opacity-80"
                style={{
                  background: photoPreview ? "transparent" : "var(--color-fg-paper-2)",
                  border: photoPreview
                    ? "2px solid var(--primary)"
                    : "2px dashed var(--color-fg-line-soft)",
                }}
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="preview" className="h-full w-full object-contain object-center" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="w-6 h-6" style={{ color: "var(--color-fg-ink-muted)" }} />
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
            {photoError && <p role="alert" className="mt-3 max-w-[280px] text-center text-sm text-red-600">{photoError}</p>}
            {photoPreview ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <p className="text-[10px] text-center leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                  탭하여 변경<br />
                  카드 사진 드래그로 크기조절
                </p>
                {/* 크기 표시 */}
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
            ) : null}
          </div>
        </div>

        <div className="space-y-6 md:order-1">
          {/* 이름 — 구글 가입은 구글 계정 이름이 그대로 채워지므로 실명 확인이 필요하다 */}
          <div>
            <FieldLabel htmlFor="setup-name">이름 (실명)</FieldLabel>
            <input
              id="setup-name"
              type="text"
              placeholder="선수 실명 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              aria-describedby="setup-name-help"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={inputStyle}
            />
            <p id="setup-name-help" className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
              여기 입력한 이름이 경기 기록·선수 카드·장내 호명에 그대로 표기됩니다.
            </p>
            {needsKoreanNameCheck(name) && (
              <p
                role="status"
                className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  background: "rgba(255,59,48,0.08)",
                  border: "1px solid rgba(255,59,48,0.20)",
                  color: "var(--destructive)",
                }}
              >
                한글 실명이 아닙니다. 구글 계정 이름이 자동으로 채워졌다면
                <strong> 한글 실명</strong>으로 고쳐 주세요. 참가 자격 확인(JOIN KFA)도
                실명 기준으로 진행됩니다.
              </p>
            )}
          </div>

          {/* 등록 유형 */}
          <div>
            <FieldLabel>등록 유형</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleRoleChange(option.value)}
                    className="px-3 py-3 rounded-2xl text-left transition-all"
                    style={{
                      background: selected ? "var(--color-fg-paper-3)" : "var(--color-fg-paper)",
                      border: `1.5px solid ${selected ? "var(--primary)" : "var(--color-fg-line-soft)"}`,
                    }}
                  >
                    <div
                      className="font-black text-sm leading-none mb-1"
                      style={{
                        fontFamily: "var(--font-pretendard)",
                        color: selected ? "var(--primary)" : "var(--color-fg-ink)",
                      }}
                    >
                      {option.label}
                    </div>
                    <div className="text-[10px] leading-snug" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {option.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 등번호 */}
          <div>
            <FieldLabel htmlFor="setup-number">등번호</FieldLabel>
            <input
              id="setup-number"
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
                    onClick={() => setPosition(pos.value)}
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

          {/* 팀 */}
          <div>
            <FieldLabel htmlFor="setup-team">
              팀 <span style={{ color: "var(--color-fg-ink-muted)" }}>(선택사항)</span>
            </FieldLabel>
            <div className="relative">
              <select
                id="setup-team"
                disabled={Boolean(player?.teamId)}
                value={teamId}
                onChange={(e) => handleTeamChange(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none appearance-none"
                style={{ ...inputStyle, paddingRight: "2.5rem" }}
              >
                <option value="">팀 선택 (나중에 가입 가능)</option>
                {Object.values(teams).map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--color-fg-ink-muted)" }}
              />
            </div>
          </div>

          {/* 국적 */}
          <div>
            <FieldLabel htmlFor="setup-nationality">국적</FieldLabel>
            <div className="relative">
              <select
                id="setup-nationality"
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

          {/* 촬영물 홍보 활용 동의 — 선수 본인 동의. 팀 대표의 대리 동의와 별개로 받는다. */}
          <label
            className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
            style={inputStyle}
          >
            <input
              type="checkbox"
              checked={portraitConsent}
              onChange={(e) => setPortraitConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ accentColor: "var(--color-fg-blue, #0047AB)" }}
              required
            />
            <span
              className="text-[13px] leading-[1.7]"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              대회·행사 현장에서 촬영되는 사진·영상에 본인이 등장할 수 있으며,
              해당 촬영물이 FairGround의 홍보·마케팅 목적(온라인 채널·광고·인쇄물
              등 상업적 이용 포함)으로 기간과 횟수의 제한 없이 사용되는 것에
              동의합니다. 이에 대해 별도의 대가나 초상권을 주장하지 않습니다.
            </span>
          </label>

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
            disabled={loading || submission.submitting || bgProcessing || !!photoError || !draft.ready}
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
            {loading || submission.submitting ? "저장 중..." : "선수 카드 생성하기"}
          </button>

          <p className="text-center text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
            나중에 만들고 싶으면{" "}
            <button
              type="button"
              onClick={() => router.push("/my")}
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: "var(--primary)" }}
            >
              건너뛰기
            </button>
          </p>
        </div>

      </fieldset>
      </form>
    </div>
  );
}
