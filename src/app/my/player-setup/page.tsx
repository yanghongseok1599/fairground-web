"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, Camera, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { COUNTRIES } from "@/constants/countries";
import { PlayerCard } from "@/components/player-card";
import { compressImageBlob } from "@/lib/image-compression";
import type { Position, Player, PlayerRole } from "@/types";

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
  { value: "player", label: "선수", desc: "선수 카드와 FA/팀 선수로 등록" },
  { value: "captain", label: "감독", desc: "팀 홈페이지 관리 가능 · 전체 관리자는 아님" },
  { value: "referee", label: "심판", desc: "승인 후 경기 운영 메뉴 접근" },
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

// lg 카드 크기 + 사진 영역 (player-card.tsx POS.photo와 동일하게 유지)
const CARD_W = 280;
const CARD_H = Math.round(CARD_W * 1240 / 1080);
const PHOTO_OVERLAY = { x: 47, y: 14.5, w: 27, h: 38 };

export default function PlayerSetupPage() {
  const router = useRouter();
  const { loading, error, clearError, createPlayer, uploadPlayerPhoto, initialized } = useAuth();
  const { teams, fetchTeams } = useDataStore();

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<Position | "">("");
  const [role, setRole] = useState<Exclude<PlayerRole, "admin">>("player");
  const [teamId, setTeamId] = useState("");
  const [nationality, setNationality] = useState("KOR");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);         // 배경제거본 (카드용)
  const [originalPhotoBlob, setOriginalPhotoBlob] = useState<Blob | null>(null); // 원본 (프로필용)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);   // 우측 썸네일: 원본
  const [cardPhotoPreview, setCardPhotoPreview] = useState<string | null>(null); // 카드: 배경제거
  const [bgProcessing, setBgProcessing] = useState(false);
  const [photoScale, setPhotoScale] = useState(1.0);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 카드 위 드래그로 사진 크기 조절
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScale = useRef(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchStartScale = useRef(1);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

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
    if (!el || !photoPreview) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setPhotoScale(s => Math.min(2.5, Math.max(0.5, s - e.deltaY * 0.002)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [photoPreview]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);

    const compressed = await compressImageBlob(file, {
      maxPx: 1400,
      mimeType: "image/webp",
      quality: 0.9,
    });
    // 우측 썸네일: 원본 압축본 바로 표시
    setPhotoPreview(URL.createObjectURL(compressed));
    setCardPhotoPreview(null);
    setPhotoBlob(compressed);
    setOriginalPhotoBlob(compressed); // 원본 보관

    // 카드용 배경제거 (비동기)
    setBgProcessing(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const bgRemoved = await removeBackground(compressed, {
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
        debug: false,
      });
      const optimizedCardPhoto = await compressImageBlob(bgRemoved, {
        maxPx: 1400,
        mimeType: "image/webp",
        quality: 0.92,
      });
      setCardPhotoPreview(URL.createObjectURL(optimizedCardPhoto));
      setPhotoBlob(optimizedCardPhoto); // 저장은 배경제거본 압축본으로
    } catch {
      setCardPhotoPreview(URL.createObjectURL(compressed)); // 실패 시 원본
    } finally {
      setBgProcessing(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBlob(null);
    setOriginalPhotoBlob(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);
    setPhotoPreview(null);
    setCardPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!position) return;
    try {
      let photoUrl = "";
      let profilePhotoUrl = "";
      if (photoBlob) {
        const photoFile = new File([photoBlob], "photo.webp", {
          type: photoBlob.type || "image/webp",
        });
        photoUrl = await uploadPlayerPhoto(photoFile);
      }
      if (originalPhotoBlob) {
        const origFile = new File([originalPhotoBlob], "profile.webp", {
          type: originalPhotoBlob.type || "image/webp",
        });
        profilePhotoUrl = await uploadPlayerPhoto(origFile);
      }
      await createPlayer({
        name: name.trim(),
        number: parseInt(number, 10),
        position: position as Position,
        teamId: teamId || "",
        nationality,
        photoUrl,
        profilePhotoUrl,
        photoScale,
      });
      setDone(true);
      setTimeout(() => router.push("/players"), 1800);
    } catch {
      // error in store
    }
  };

  if (!initialized) {
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

  const previewPlayer: Player = {
    id: "preview",
    uid: "preview",
    name: name.trim() || "이름",
    number: parseInt(number, 10) || 10,
    position: (position as Position) || "ALA",
    teamId: teamId || "",
    nationality: nationality || "KOR",
    photoUrl: cardPhotoPreview || photoPreview || "",
    photoScale,
    cardType: "gold",
    cardRating: 90,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: false,
    role,
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
            <p className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>배경 제거 중...</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-ink-muted)" }}>잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="px-6 pt-8 pb-6 max-w-lg mx-auto"
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
          나만의 선수 카드 정보를 입력해주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-8 max-w-lg mx-auto space-y-6">

        {/* 카드 미리보기 + 사진 업로드 */}
        <div className="flex items-center justify-between py-2">

          {/* 좌측: 카드 미리보기 (사진 영역 드래그로 크기 조절) */}
          <div className="relative flex-shrink-0" style={{ width: CARD_W, height: CARD_H }}>
            <PlayerCard player={previewPlayer} size="lg" teamLogo={selectedTeam?.logo} disableHoverScale />

            {/* 사진 영역 인터랙션 오버레이 */}
            {(cardPhotoPreview || photoPreview) && (
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
              >
              </div>
            )}
          </div>

          {/* 우측: 사진 업로드 버튼 */}
          <div className="flex flex-col items-center gap-3 pr-4">
            <p
              className="text-[10px] uppercase tracking-[2px] self-start"
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
                  <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
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

        {/* 이름 */}
        <div>
          <FieldLabel htmlFor="setup-name">이름</FieldLabel>
          <input
            id="setup-name"
            type="text"
            placeholder="선수 이름 입력"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
            style={inputStyle}
          />
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
                  onClick={() => setRole(option.value)}
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
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
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

        {error && (
          <p
            className="text-sm px-1"
            style={{ color: "var(--destructive)" }}
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || bgProcessing || !position || !name.trim() || !number}
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
          {loading ? "생성 중..." : "선수 카드 생성하기"}
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

      </form>
    </div>
  );
}
