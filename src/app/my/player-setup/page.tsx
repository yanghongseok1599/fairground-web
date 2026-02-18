"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronDown, Camera, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { COUNTRIES } from "@/constants/countries";
import { PlayerCard } from "@/components/player-card";
import type { Position, Player } from "@/types";

const POSITIONS: { value: Position; label: string; desc: string }[] = [
  { value: "GK",   label: "GK",   desc: "골레이루 · 골키퍼" },
  { value: "FIXO", label: "FIXO", desc: "픽소 · 수비형 미드필더" },
  { value: "ALA",  label: "ALA",  desc: "알라 · 윙어" },
  { value: "PIVO", label: "PIVO", desc: "피보 · 공격수" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[2px] mb-2 font-medium"
      style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
      {children}
    </label>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#FAFCFF",
} as React.CSSProperties;

// lg 카드 크기 + 사진 영역 (player-card.tsx POS.photo와 동일하게 유지)
const CARD_W = 280;
const PHOTO_OVERLAY = { x: 47, y: 14.5, w: 27, h: 38 };

export default function PlayerSetupPage() {
  const router = useRouter();
  const { user, loading, error, clearError, createPlayer, uploadPlayerPhoto, initialized } = useAuth();
  const { teams, fetchTeams } = useDataStore();

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState<Position | "">("");
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

  useEffect(() => {
    if (!initialized) return;
    if (!user) { router.replace("/login"); return; }
  }, [initialized, user, router]);

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

  const compressImage = (file: File, maxPx = 1000): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new Image();
      const src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(src);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85);
      };
      img.src = src;
    });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (cardPhotoPreview) URL.revokeObjectURL(cardPhotoPreview);

    const compressed = await compressImage(file);
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
      setCardPhotoPreview(URL.createObjectURL(bgRemoved));
      setPhotoBlob(bgRemoved); // 저장은 배경제거본으로
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
        const photoFile = new File([photoBlob], "photo.png", { type: "image/png" });
        photoUrl = await uploadPlayerPhoto(photoFile);
      }
      if (originalPhotoBlob) {
        const origFile = new File([originalPhotoBlob], "profile.jpg", { type: "image/jpeg" });
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
      setTimeout(() => router.push("/my"), 1800);
    } catch {
      // error in store
    }
  };

  if (!initialized || (initialized && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0D1B2A" }}>
        <div className="h-8 w-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "#00C853", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "#0D1B2A" }}>
        <div className="text-center space-y-5">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,200,83,0.12)", border: "2px solid rgba(0,200,83,0.3)" }}>
            <CheckCircle className="w-9 h-9" style={{ color: "#00C853" }} />
          </div>
          <div>
            <h2 className="font-black text-2xl mb-2"
              style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-1px", color: "#FAFCFF" }}>
              선수 카드 생성 완료!
            </h2>
            <p className="text-sm" style={{ color: "#627D98" }}>
              관리자 승인 후 카드가 활성화됩니다
            </p>
          </div>
        </div>
      </div>
    );
  }

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
    role: "player",
    createdAt: Date.now(),
  };

  return (
    <div className="min-h-screen pt-[60px]" style={{ background: "#0D1B2A" }}>

      {/* 배경제거 토스트 */}
      {bgProcessing && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
          style={{
            background: "rgba(13,27,42,0.95)",
            border: "1px solid rgba(0,200,83,0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "#00C853" }} />
          <div>
            <p className="text-sm font-bold" style={{ color: "#FAFCFF" }}>배경 제거 중...</p>
            <p className="text-[10px] mt-0.5" style={{ color: "#627D98" }}>잠시만 기다려주세요</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-8 pb-6 max-w-lg mx-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[11px] uppercase tracking-[3px] mb-2"
          style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>
          Step 2 of 2
        </p>
        <h1 className="font-black text-3xl leading-tight"
          style={{ fontFamily: "var(--font-outfit)", letterSpacing: "-1.5px", color: "#FAFCFF" }}>
          선수 카드 만들기
        </h1>
        <p className="text-sm mt-2" style={{ color: "#627D98" }}>
          나만의 선수 카드 정보를 입력해주세요
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-8 max-w-lg mx-auto space-y-6">

        {/* 카드 미리보기 + 사진 업로드 */}
        <div className="flex items-center justify-between py-2">

          {/* 좌측: 카드 미리보기 (사진 영역 드래그로 크기 조절) */}
          <div className="relative flex-shrink-0" style={{ width: CARD_W, height: CARD_W }}>
            <PlayerCard player={previewPlayer} size="lg" />

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
            <p className="text-[10px] uppercase tracking-[2px] self-start"
              style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
              프로필 사진 <span style={{ color: "#3D5166" }}>(선택)</span>
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
                className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center transition-all hover:opacity-80"
                style={{
                  background: photoPreview ? "transparent" : "rgba(255,255,255,0.06)",
                  border: photoPreview ? "2px solid rgba(0,200,83,0.4)" : "2px dashed rgba(255,255,255,0.15)",
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="w-6 h-6" style={{ color: "#627D98" }} />
                    <span className="text-[9px] uppercase tracking-wider text-center"
                      style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>사진 추가</span>
                  </div>
                )}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "#FF6B6B" }}
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
            {photoPreview ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <p className="text-[9px] text-center leading-relaxed" style={{ color: "#3D5166" }}>
                  탭하여 변경<br />
                  카드 사진 드래그로 크기조절
                </p>
                {/* 크기 표시 */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "#627D98", fontSize: 9, fontFamily: "monospace" }}>↕</span>
                  <span className="font-black tabular-nums"
                    style={{ color: "#FAFCFF", fontSize: 13, fontFamily: "var(--font-outfit)" }}>
                    {Math.round(photoScale * 100)}%
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 이름 */}
        <div>
          <FieldLabel>이름</FieldLabel>
          <input
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
          <FieldLabel>등번호</FieldLabel>
          <input
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
            {POSITIONS.map((pos) => (
              <button
                key={pos.value}
                type="button"
                onClick={() => setPosition(pos.value)}
                className="text-left px-4 py-3 rounded-2xl transition-all"
                style={{
                  background: position === pos.value ? "rgba(0,200,83,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${position === pos.value ? "rgba(0,200,83,0.5)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <div className="font-black text-base leading-none mb-0.5"
                  style={{ fontFamily: "var(--font-outfit)", color: position === pos.value ? "#00C853" : "#FAFCFF" }}>
                  {pos.label}
                </div>
                <div className="text-[10px]" style={{ color: "#627D98" }}>{pos.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 팀 */}
        <div>
          <FieldLabel>팀 <span style={{ color: "#3D5166" }}>(선택사항)</span></FieldLabel>
          <div className="relative">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none appearance-none"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            >
              <option value="" style={{ background: "#0D1B2A" }}>팀 선택 (나중에 가입 가능)</option>
              {Object.values(teams).map((team) => (
                <option key={team.id} value={team.id} style={{ background: "#0D1B2A" }}>{team.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "#627D98" }} />
          </div>
        </div>

        {/* 국적 */}
        <div>
          <FieldLabel>국적</FieldLabel>
          <div className="relative">
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none appearance-none"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value} style={{ background: "#0D1B2A" }}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "#627D98" }} />
          </div>
        </div>

        {error && (
          <p className="text-xs px-1" style={{ color: "#FF6B6B" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || bgProcessing || !position || !name.trim() || !number}
          className="w-full py-4 rounded-2xl text-sm font-black transition-all hover:opacity-90 disabled:opacity-30"
          style={{ background: "#00C853", color: "#0D1B2A", fontFamily: "var(--font-outfit)", letterSpacing: "-0.5px", fontSize: 15 }}>
          {loading ? "생성 중..." : "선수 카드 생성하기"}
        </button>

        <p className="text-center text-xs" style={{ color: "#627D98" }}>
          나중에 만들고 싶으면{" "}
          <button type="button" onClick={() => router.push("/my")}
            className="font-semibold hover:opacity-80 transition-opacity"
            style={{ color: "#4FC3F7" }}>
            건너뛰기
          </button>
        </p>

      </form>
    </div>
  );
}
