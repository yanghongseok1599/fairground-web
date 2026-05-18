"use client";

import type { Player, CardType } from "@/types";
import { BADGES } from "@/constants/badges";

interface PlayerCardProps {
  player: Player;
  size?: "sm" | "md" | "lg" | "xl";
  teamLogo?: string;
  onClick?: () => void;
}

function countryToFlagCode(code: string): string {
  const upper = code.toUpperCase();
  const map: Record<string, string> = {
    KOR: "kr", USA: "us", BRA: "br", JPN: "jp", CHN: "cn",
    GBR: "gb", FRA: "fr", DEU: "de", ESP: "es", ITA: "it",
    KR: "kr", US: "us", BR: "br", JP: "jp", CN: "cn",
    GB: "gb", FR: "fr", DE: "de", ES: "es", IT: "it",
  };
  return map[upper] || upper.slice(0, 2).toLowerCase();
}

// ============================================================
// ★ 카드 레이아웃 프리셋 (cardType 별) ★
// 02_ux-architect §3 여정D / §7 — 좌표 매직넘버를 LAYOUT[cardType]로 분리.
// gold-card.png 실드 외곽선 픽셀 분석 데이터 기반:
//   실드 폭: 상단(y=8%) 43%, 중앙(y=50%) 63%, 하단(y=90%) 43%
// premium 자산이 추가되면 LAYOUT.premium 값만 보정하면 됨(좌표 디커플링 2단계).
// ============================================================
const DEBUG = false;

interface CardLayout {
  /** 배경 이미지 경로 */
  bg: string;
  /** 좌측 열(레이팅·포지션·로고·국기) 중심선 (%) */
  leftColCenter: number;
  /** 각 요소 위치 (카드 정사각형 기준 %) */
  pos: {
    rating: { y: number };
    pos: { y: number };
    logo: { y: number };
    flag: { y: number };
    photo: { x: number; y: number; w: number; h: number };
    name: { y: number; w: number };
    badges: { y: number };
    stats: { y: number };
  };
  /** 폰트/이미지 크기 (카드 너비의 %) */
  fontPct: {
    rating: number;
    pos: number;
    flag: number;
    name: number;
    statVal: number;
    statLabel: number;
    badge: number;
    logo: number;
  };
  /** 티어별 잉크(텍스트) — 브랜드키트 토큰만 참조(하드코딩 hex 금지).
   *  solid = var(--card-ink-*), rgb = rgba 합성용 CSS 변수 채널. */
  ink: {
    /** solid 색 (rating/pos/name/stat) — var(--card-ink-*) */
    solid: string;
    /** alpha 합성용 rgb 채널 변수 — var(--card-ink-*-rgb) */
    rgb: string;
  };
}

// "gold" 티어 = standard 기본 트리트먼트. 색은 브랜드키트 토큰만 사용.
// (CardType 값 "gold" 는 데이터 호환 위해 유지하되, 시각은 gold 색 아님)
const GOLD_LAYOUT: CardLayout = {
  bg: "/images/gold-card.png",
  leftColCenter: 33,
  pos: {
    rating: { y: 16 },
    pos: { y: 29 },
    logo: { y: 37 },
    flag: { y: 45 },
    photo: { x: 47, y: 14.5, w: 27, h: 38 },
    name: { y: 52, w: 48 },
    badges: { y: 60 },
    stats: { y: 74.6 },
  },
  fontPct: {
    rating: 11,
    pos: 4.5,
    flag: 9.3,
    name: 5.5,
    statVal: 5,
    statLabel: 3.5,
    badge: 4.5,
    logo: 6,
  },
  ink: {
    solid: "var(--card-ink-standard)",
    rgb: "var(--card-ink-standard-rgb)",
  },
};

// premium — Premium Deep Blue 트리트먼트(브랜드키트 2026: NO gold for premium).
// 동일 실드 형상 가정으로 좌표는 standard 재사용, 잉크 토큰만 분리.
// TODO(premium 자산): /public/images/premium-card.png 부재 → gold-card.png 폴백.
//   premium-card.png(딥블루 트리트먼트) 추가 시 아래 bg 를
//   "/images/premium-card.png" 로 교체하고, 실드 형상이 다르면
//   pos/fontPct 값을 자산에 맞춰 보정할 것 (§7 2단계).
const PREMIUM_LAYOUT: CardLayout = {
  ...GOLD_LAYOUT,
  bg: "/images/gold-card.png", // FALLBACK — premium-card.png 미존재
  ink: {
    solid: "var(--card-ink-premium)",
    rgb: "var(--card-ink-premium-rgb)",
  },
};

const LAYOUT: Record<CardType, CardLayout> = {
  gold: GOLD_LAYOUT,
  premium: PREMIUM_LAYOUT,
};

const CARD_TYPE_LABEL: Record<CardType, string> = {
  gold: "골드",
  premium: "프리미엄",
};
// ============================================================

const sizeConfig = {
  sm: { w: 130 },
  md: { w: 200 },
  lg: { w: 280 },
  xl: { w: 560 },
};

export function PlayerCard({
  player,
  size = "md",
  teamLogo,
  onClick,
}: PlayerCardProps) {
  const cardW = sizeConfig[size].w;

  const cardType: CardType = player.cardType ?? "gold";
  const layout = LAYOUT[cardType] ?? GOLD_LAYOUT;
  const { pos: POS, fontPct: FONT_PCT, leftColCenter: LEFT_COL_CENTER, ink } = layout;

  const fs = {
    rating: Math.round(cardW * FONT_PCT.rating / 100),
    pos: Math.round(cardW * FONT_PCT.pos / 100),
    flag: Math.round(cardW * FONT_PCT.flag / 100),
    name: Math.round(cardW * FONT_PCT.name / 100),
    statVal: Math.round(cardW * FONT_PCT.statVal / 100),
    statLabel: Math.round(cardW * FONT_PCT.statLabel / 100),
    badge: Math.round(cardW * FONT_PCT.badge / 100),
    logo: Math.round(cardW * FONT_PCT.logo / 100),
  };

  // A3 (§6): 카드 정보 전체를 단일 의미로 노출. 내부 장식 img 는 alt="" 유지.
  const ariaLabel = `${player.name}, ${player.position}, 레이팅 ${player.cardRating}, ${CARD_TYPE_LABEL[cardType]} 카드`;

  const cardInner = (
    <>
      {/* Card Background (티어별) — 장식, 의미는 컨테이너 aria-label 이 제공 */}
      <img
        src={layout.bg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        draggable={false}
      />

      {/* Debug: shield mid-section boundary */}
      {DEBUG && (
        <div
          className="absolute pointer-events-none border-2 border-red-500/60"
          style={{ left: "18.5%", top: "14%", width: "63%", height: "72%" }}
        />
      )}

      {/* Rating */}
      <span
        className="absolute font-black"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.rating.y}%`,
          transform: "translateX(-50%)",
          color: ink.solid,
          fontSize: fs.rating,
          lineHeight: 1,
          letterSpacing: "-0.05em",
          WebkitTextStroke: "0.1px currentColor",
          zIndex: 2,
        }}
      >
        {player.cardRating}
      </span>

      {/* Position */}
      <span
        className="absolute font-black"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.pos.y}%`,
          transform: "translateX(-50%)",
          color: `rgba(${ink.rgb}, 0.8)`,
          fontSize: fs.pos,
          lineHeight: 1,
          zIndex: 2,
        }}
      >
        {player.position}
      </span>

      {/* Flag — 직사각형 정식 국기 */}
      <img
        src={`https://flagcdn.com/w80/${countryToFlagCode(player.nationality || "KR")}.png`}
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.flag.y}%`,
          transform: "translateX(-50%)",
          width: fs.flag,
          zIndex: 2,
        }}
      />

      {/* Team Logo — 정사각형 */}
      {teamLogo ? (
        <img
          src={teamLogo}
          alt=""
          aria-hidden="true"
          className="absolute object-contain"
          style={{
            left: `${LEFT_COL_CENTER}%`,
            top: `${POS.logo.y}%`,
            transform: "translateX(-50%)",
            width: fs.logo,
            height: fs.logo,
            zIndex: 2,
          }}
        />
      ) : (
        <div
          className="absolute flex items-center justify-center rounded-[3px]"
          style={{
            left: `${LEFT_COL_CENTER}%`,
            top: `${POS.logo.y}%`,
            transform: "translateX(-50%)",
            width: fs.logo,
            height: fs.logo,
            border: `1px solid rgba(${ink.rgb}, 0.4)`,
            background: `rgba(${ink.rgb}, 0.2)`,
            zIndex: 2,
          }}
        >
          <span
            className="font-black"
            style={{ fontSize: fs.logo * 0.45, color: `rgba(${ink.rgb}, 0.6)` }}
          >
            FC
          </span>
        </div>
      )}

      {/* Player Photo — 세로 직사각형 */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${POS.photo.x}%`,
          top: `${POS.photo.y}%`,
          width: `${POS.photo.w}%`,
          height: `${POS.photo.h}%`,
          borderRadius: 3,
          border: DEBUG ? "1px dashed blue" : "none",
          zIndex: 1,
        }}
      >
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
            style={(player.photoScale && player.photoScale !== 1) || player.photoOffsetX ? {
              transform: `scale(${player.photoScale ?? 1}) translateX(${player.photoOffsetX ?? 0}%)`,
              transformOrigin: "center bottom",
            } : undefined}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "transparent" }}
          >
            <span
              className="font-bold"
              style={{ fontSize: fs.rating * 0.6, color: `rgba(${ink.rgb}, 0.12)` }}
            >
              {player.number}
            </span>
          </div>
        )}
      </div>

      {/* Name Bar */}
      <div
        className="absolute truncate font-bold uppercase tracking-[0.15em] text-center"
        style={{
          left: "50%",
          top: `${POS.name.y}%`,
          width: `${POS.name.w}%`,
          transform: "translateX(-50%)",
          color: ink.solid,
          fontSize: fs.name,
          paddingTop: fs.name * 0.25,
          paddingBottom: fs.name * 0.25,
          zIndex: 2,
        }}
      >
        {player.name}
      </div>

      {/* Badges Row or Decorative Divider */}
      {(player.badges ?? []).length > 0 ? (
        <div
          className="absolute flex justify-center"
          style={{
            left: "50%",
            top: `${POS.badges.y}%`,
            transform: "translateX(-50%)",
            zIndex: 2,
          }}
        >
          {(player.badges ?? []).slice(0, 4).map((badgeId, idx) => {
            const badge = BADGES.find((b) => b.id === badgeId);
            if (!badge) return null;
            return (
              <img
                key={badgeId}
                src={badge.imageUrl}
                alt=""
                aria-hidden="true"
                title={badge.name}
                className="object-contain"
                style={{
                  height: fs.badge * 3.2,
                  marginLeft: idx > 0 ? -fs.badge * 0.6 : 0,
                  // 깊이 그림자(중립 흑) + 티어 잉크 글로우(브랜드 토큰) — gold 하드코딩 제거
                  filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 3px rgba(${ink.rgb}, 0.25))`,
                }}
              />
            );
          })}
        </div>
      ) : (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: "50%",
            top: `${POS.badges.y + 3}%`,
            transform: "translateX(-50%)",
            width: "42%",
            zIndex: 2,
          }}
        >
          <div className="flex-1 border-t" style={{ borderColor: `rgba(${ink.rgb}, 0.25)` }} />
          <div
            className="mx-1.5 rotate-45"
            style={{ width: fs.badge * 0.5, height: fs.badge * 0.5, border: `1px solid rgba(${ink.rgb}, 0.3)` }}
          />
          <div className="flex-1 border-t" style={{ borderColor: `rgba(${ink.rgb}, 0.25)` }} />
        </div>
      )}

      {/* Stats Row */}
      <div
        className="absolute flex justify-center"
        style={{
          left: "50%",
          top: `${POS.stats.y}%`,
          transform: "translateX(-50%)",
          color: ink.solid,
          gap: cardW * 0.04,
          zIndex: 2,
        }}
      >
        {[
          { val: player.stats.goals, label: "골" },
          { val: player.stats.assists, label: "어시" },
          { val: player.stats.games, label: "경기" },
          { val: player.stats.mom, label: "MOM" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center leading-tight">
            <span className="font-black" style={{ fontSize: fs.statVal }}>
              {stat.val}
            </span>
            <span
              className="font-black"
              style={{ fontSize: fs.statLabel, color: ink.solid }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  // A4 (§6): onClick 이 있으면 키보드 접근 가능한 <button>. 없으면
  // 비대화형 컨테이너(부모 Link/캐러셀 안 중첩 인터랙티브 방지).
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="relative block cursor-pointer select-none appearance-none border-0 bg-transparent p-0 text-left transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        style={{ width: cardW, height: cardW }}
      >
        {cardInner}
      </button>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="relative select-none transition-transform hover:scale-105"
      style={{ width: cardW, height: cardW }}
    >
      {cardInner}
    </div>
  );
}
