"use client";

import type { Player } from "@/types";
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
// ★ 카드 레이아웃 설정 ★
// gold-card.png 실드 외곽선 픽셀 분석 데이터 기반
// 실드 폭: 상단(y=8%) 43%, 중앙(y=50%) 63%, 하단(y=90%) 43%
// → 사각형 컨테이너 대신 각 요소를 카드 정사각형에 직접 배치
// ============================================================
const DEBUG = false;

// 요소 위치 (카드 정사각형 기준 %)
// 좌측 열 (rating, pos, logo, flag)은 centerX 기준 중앙정렬
const LEFT_COL_CENTER = 33;                              // 좌측 열 중심선 (%)
const POS = {
  rating:  { y: 16 },                                   // 레이팅 숫자
  pos:     { y: 29 },                                   // 포지션 텍스트
  logo:    { y: 37 },                                   // 팀 로고
  flag:    { y: 45 },                                   // 국기
  photo:   { x: 47, y: 14.5, w: 27, h: 38 },            // 선수 사진 (세로 직사각형)
  name:    { y: 52, w: 48 },                             // 이름 바 (중앙정렬)
  badges:  { y: 60 },                                    // 뱃지 행 (중앙정렬)
  stats:   { y: 74.6 },                                  // 스탯 행 (중앙정렬)
};

// 폰트 크기 (카드 너비의 %)
const FONT_PCT = {
  rating: 11,      // 레이팅 숫자 (큰 숫자)
  pos: 4.5,        // 포지션
  flag: 9.3,       // 국기 이미지 너비
  name: 5.5,       // 이름
  statVal: 5,      // 스탯 숫자
  statLabel: 3.5,  // 스탯 라벨
  badge: 4.5,      // 뱃지 아이콘 크기
  logo: 6,         // 팀 로고 크기
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

  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer select-none transition-transform hover:scale-105"
      style={{ width: cardW, height: cardW }}
    >
      {/* Gold Card Background */}
      <img
        src="/images/gold-card.png"
        alt=""
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
        className="absolute font-black text-[#5c4a1e]"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.rating.y}%`,
          transform: "translateX(-50%)",
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
        className="absolute font-black text-[#5c4a1e]/80"
        style={{
          left: `${LEFT_COL_CENTER}%`,
          top: `${POS.pos.y}%`,
          transform: "translateX(-50%)",
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
          className="absolute flex items-center justify-center rounded-[3px] border border-[#5c4a1e]/40 bg-[#5c4a1e]/20"
          style={{
            left: `${LEFT_COL_CENTER}%`,
            top: `${POS.logo.y}%`,
            transform: "translateX(-50%)",
            width: fs.logo,
            height: fs.logo,
            zIndex: 2,
          }}
        >
          <span className="font-black text-[#5c4a1e]/60" style={{ fontSize: fs.logo * 0.45 }}>
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
            alt={player.name}
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
              className="font-bold text-[#5c4a1e]/12"
              style={{ fontSize: fs.rating * 0.6 }}
            >
              {player.number}
            </span>
          </div>
        )}
      </div>

      {/* Name Bar */}
      <div
        className="absolute truncate font-bold uppercase tracking-[0.15em] text-[#3d3220] text-center"
        style={{
          left: "50%",
          top: `${POS.name.y}%`,
          width: `${POS.name.w}%`,
          transform: "translateX(-50%)",
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
                alt={badge.name}
                title={badge.name}
                className="object-contain"
                style={{ height: fs.badge * 3.2, marginLeft: idx > 0 ? -fs.badge * 0.6 : 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 3px rgba(180,158,108,0.2))" }}
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
          <div className="flex-1 border-t border-[#5c4a1e]/25" />
          <div
            className="mx-1.5 rotate-45 border border-[#5c4a1e]/30"
            style={{ width: fs.badge * 0.5, height: fs.badge * 0.5 }}
          />
          <div className="flex-1 border-t border-[#5c4a1e]/25" />
        </div>
      )}

      {/* Stats Row */}
      <div
        className="absolute flex justify-center text-[#4a3a15]"
        style={{
          left: "50%",
          top: `${POS.stats.y}%`,
          transform: "translateX(-50%)",
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
              className="font-black text-[#4a3a15]"
              style={{ fontSize: fs.statLabel }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
