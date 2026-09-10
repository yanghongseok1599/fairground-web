"use client";

import type { Player, CardType } from "@/types";
import { BADGES } from "@/constants/badges";
import { useTeamLogoBackgroundRemoval } from "@/hooks/useTeamLogoBackgroundRemoval";
import {
  PLAYER_CARD_FRAME,
  PLAYER_CARD_FRAME_ID,
  PLAYER_CARD_PRESET_ID,
  getPlayerCardFrameDimensions,
  type PlayerCardSize,
} from "@/lib/player-card-frame";
import {
  PLAYER_CARD_IMAGE_SET_ID,
  resolvePlayerCardPhoto,
} from "@/lib/player-card-pose-templates";
import { getPlayerCardDisplaySkin, type PlayerCardContext } from "@/lib/player-card-skin";
import { DEFAULT_CARD_PHOTO_SCALE } from "@/lib/player-profile-photo";
import { UpperBodyPortrait } from "@/components/upper-body-portrait";

interface PlayerCardProps {
  player: Player;
  size?: PlayerCardSize;
  teamLogo?: string;
  onClick?: () => void;
  disableHoverScale?: boolean;
  cardContext?: PlayerCardContext;
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
// ★ 카드 비주얼 스킨 (cardType 별) ★
// 위치와 크기는 PLAYER_CARD_FRAME에서만 관리한다. 카드 등급은 배경과 잉크만
// 바꿀 수 있으므로 어느 화면에서 사용해도 콘텐츠 슬롯은 완전히 동일하다.
// ============================================================
const DEBUG = false;

interface CardVisualSkin {
  /** 배경 이미지 경로 */
  bg: string;
  /** 티어별 잉크(텍스트) — 브랜드키트 토큰만 참조(하드코딩 hex 금지).
   *  solid = var(--card-ink-*), rgb = rgba 합성용 CSS 변수 채널. */
  ink: {
    /** solid 색 (rating/pos/name/stat) — var(--card-ink-*) */
    solid: string;
    /** alpha 합성용 rgb 채널 변수 — var(--card-ink-*-rgb) */
    rgb: string;
  };
}

type VisualCardType = CardType | "hologram";

// "gold" 티어 = standard 기본 트리트먼트. 색은 브랜드키트 토큰만 사용.
// (CardType 값 "gold" 는 데이터 호환 위해 유지하되, 시각은 gold 색 아님)
const STANDARD_SKIN: CardVisualSkin = {
  bg: "/images/gold-card-ducktape.webp?v=4",
  ink: {
    solid: "var(--card-ink-standard)",
    rgb: "var(--card-ink-standard-rgb)",
  },
};

const PREMIUM_SKIN: CardVisualSkin = {
  bg: "/images/premium-card-matched.webp?v=4",
  ink: {
    solid: "var(--card-ink-premium)",
    rgb: "var(--card-ink-premium-rgb)",
  },
};

const BRONZE_SKIN: CardVisualSkin = {
  bg: "/images/bronze-card.webp?v=9",
  ink: {
    solid: "#3b2112",
    rgb: "59, 33, 18",
  },
};

const SILVER_SKIN: CardVisualSkin = {
  bg: "/images/silver-card.webp?v=9",
  ink: {
    solid: "#152033",
    rgb: "21, 32, 51",
  },
};

const HOLOGRAM_SKIN: CardVisualSkin = {
  bg: "/images/hologram-card.webp?v=3",
  ink: {
    solid: "var(--card-ink-standard)",
    rgb: "var(--card-ink-standard-rgb)",
  },
};

const CARD_SKIN: Record<VisualCardType, CardVisualSkin> = {
  bronze: BRONZE_SKIN,
  silver: SILVER_SKIN,
  gold: STANDARD_SKIN,
  premium: PREMIUM_SKIN,
  hologram: HOLOGRAM_SKIN,
};

const CARD_TYPE_LABEL: Record<CardType, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  premium: "플래티넘",
};

export function getCardTypeFromRating(rating: number): CardType {
  if (rating >= 100) return "premium";
  if (rating >= 90) return "gold";
  if (rating >= 80) return "silver";
  return "bronze";
}
export function PlayerCard({
  player,
  size = "md",
  teamLogo,
  onClick,
  disableHoverScale = false,
  cardContext = "league",
}: PlayerCardProps) {
  const { width: cardW, height: cardH } = getPlayerCardFrameDimensions(size);

  const cardType = getCardTypeFromRating(player.cardRating);
  const visualCardType: VisualCardType = getPlayerCardDisplaySkin(player, cardContext) === "hologram" ? "hologram" : cardType;
  const skin = CARD_SKIN[visualCardType] ?? STANDARD_SKIN;
  const processedTeamLogo = useTeamLogoBackgroundRemoval(teamLogo);
  const { pos: POS, fontPct: FONT_PCT, leftColCenter: LEFT_COL_CENTER } = PLAYER_CARD_FRAME;
  const { ink } = skin;
  const playerPhotoScale = player.photoScale ?? DEFAULT_CARD_PHOTO_SCALE;
  const playerPhotoUrl = resolvePlayerCardPhoto(player);

  const fs = {
    rating: Math.round(cardW * FONT_PCT.rating / 100),
    pos: Math.round(cardW * FONT_PCT.position / 100),
    flag: Math.round(cardW * FONT_PCT.flag / 100),
    name: Math.round(cardW * FONT_PCT.name / 100),
    statVal: Math.round(cardW * FONT_PCT.statVal / 100),
    statLabel: Math.round(cardW * FONT_PCT.statLabel / 100),
    badge: Math.round(cardW * FONT_PCT.badge / 100 * 0.95),
    logo: Math.round(cardW * FONT_PCT.logo / 100),
  };

  // A3 (§6): 카드 정보 전체를 단일 의미로 노출. 내부 장식 img 는 alt="" 유지.
  const cardLabel = visualCardType === "hologram" ? "그라운드 챌린지 홀로그램" : CARD_TYPE_LABEL[cardType];
  const ariaLabel = `${player.name}, ${player.position}, 레이팅 ${player.cardRating}, ${cardLabel} 카드`;

  const cardInner = (
    <>
      {/* Card Background (티어별) — 장식, 의미는 컨테이너 aria-label 이 제공 */}
      <img
        src={skin.bg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        style={{
          filter:
            visualCardType === "premium"
              ? [
                  "drop-shadow(0 0 5px rgba(90, 255, 210, 0.88))",
                  "drop-shadow(0 0 13px rgba(0, 230, 180, 0.44))",
                  "drop-shadow(0 10px 18px rgba(0, 0, 0, 0.32))",
                ].join(" ")
              : undefined,
        }}
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
          top: `${POS.position.y}%`,
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
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.flag.y}%`,
          transform: "translateX(-50%)",
          width: fs.flag,
          height: fs.flag * 0.65,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45)) drop-shadow(0 0 2px rgba(255,255,255,0.65))",
          zIndex: 2,
        }}
      >
        <img
          src={`https://flagcdn.com/w80/${countryToFlagCode(player.nationality || "KR")}.png`}
          alt=""
          aria-hidden="true"
          className="block"
          style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
          draggable={false}
        />
      </div>

      {/* Team Logo — 정사각형 */}
      {processedTeamLogo ? (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${LEFT_COL_CENTER}%`,
            top: `${POS.logo.y}%`,
            transform: "translateX(-50%)",
            width: fs.logo,
            height: fs.logo,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 3px rgba(255,255,255,0.5))",
            zIndex: 2,
          }}
        >
          <img
            src={processedTeamLogo}
            alt=""
            aria-hidden="true"
            className="block"
            style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
            draggable={false}
          />
        </div>
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
            boxShadow: "0 2px 4px rgba(0,0,0,0.45), 0 0 3px rgba(255,255,255,0.45)",
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
        className="absolute overflow-hidden flex items-end justify-center"
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
        <UpperBodyPortrait
          src={playerPhotoUrl}
          scale={playerPhotoScale}
          offsetX={player.photoOffsetX ?? 0}
          shadow={player.gender !== "female"}
        />
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
                  height: fs.badge * 2.745,
                  marginLeft: idx > 0 ? fs.badge * 0.225 : 0,
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
          color: "#050505",
          fontFamily: "var(--font-pretendard)",
          gap: cardW * 0.055,
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
            <span className="font-black" style={{ fontSize: fs.statVal, fontFamily: "var(--font-pretendard)" }}>
              {stat.val}
            </span>
            <span
              className="font-black"
              style={{ fontSize: fs.statLabel, color: "#050505", fontFamily: "var(--font-pretendard)" }}
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
        data-player-card-frame={PLAYER_CARD_FRAME_ID}
        data-player-card-image-set={PLAYER_CARD_IMAGE_SET_ID}
        data-player-card-preset={PLAYER_CARD_PRESET_ID}
        data-player-card-size={size}
        className={`relative block cursor-pointer select-none appearance-none border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
          disableHoverScale ? "" : "transition-transform hover:scale-105"
        }`}
        style={{ width: cardW, height: cardH }}
      >
        {cardInner}
      </button>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-player-card-frame={PLAYER_CARD_FRAME_ID}
      data-player-card-image-set={PLAYER_CARD_IMAGE_SET_ID}
      data-player-card-preset={PLAYER_CARD_PRESET_ID}
      data-player-card-size={size}
      className={`relative select-none ${disableHoverScale ? "" : "transition-transform hover:scale-105"}`}
      style={{ width: cardW, height: cardH }}
    >
      {cardInner}
    </div>
  );
}
