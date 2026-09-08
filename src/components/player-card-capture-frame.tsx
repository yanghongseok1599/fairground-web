"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerCard } from "@/components/player-card";
import { PLAYER_CARD_PRESET_ID, type PlayerCardSize } from "@/lib/player-card-frame";
import type { Player } from "@/types";

type CardSize = Extract<PlayerCardSize, "lg" | "xl" | "export">;

interface PlayerCardCaptureFrameProps {
  player: Player;
  teamLogo?: string;
  boxSize: number;
  cardSize: CardSize;
  cardScale?: number;
  logoHeight?: number;
  displayWidth?: number | string;
  className?: string;
}

export function PlayerCardCaptureFrame({
  player,
  teamLogo,
  boxSize,
  cardSize,
  cardScale,
  logoHeight = Math.round(boxSize * 0.055),
  displayWidth,
  className = "",
}: PlayerCardCaptureFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(boxSize);
  const effectiveScale = cardScale ?? (boxSize / 280);
  const responsiveRatio = renderedWidth / boxSize;
  const visualScale = effectiveScale * responsiveRatio;
  const visualLogoHeight = logoHeight * responsiveRatio;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => {
      const width = frame.getBoundingClientRect().width;
      setRenderedWidth(width > 0 ? width : boxSize);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [boxSize, displayWidth]);

  return (
    <div
      ref={frameRef}
      data-player-card-export-preset={PLAYER_CARD_PRESET_ID}
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        width: displayWidth ?? boxSize,
        maxWidth: "100%",
        height: displayWidth ? undefined : boxSize,
        aspectRatio: "1 / 1",
      }}
    >
      <img
        src="/images/space-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
      <div
        className="absolute"
        style={{
          left: "50%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          width: "80%",
          height: "80%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,168,76,0.28) 0%, rgba(201,168,76,0.08) 40%, transparent 65%)",
        }}
      />
      {[-18, -6, 0, 6, 18].map((deg, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: "50%",
            top: 0,
            width: i === 2 ? 3 : 2,
            height: "130%",
            background: `linear-gradient(to bottom, transparent 0%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 30%, rgba(201,168,76,${i === 2 ? 0.15 : 0.06}) 48%, rgba(201,168,76,${i === 2 ? 0.1 : 0.04}) 66%, transparent 100%)`,
            transform: `translateX(-50%) rotate(${deg}deg)`,
            transformOrigin: "50% 45%",
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: "6%" }}>
        <div style={{ transform: `scale(${visualScale})`, transformOrigin: "center center" }}>
          <PlayerCard player={player} size={cardSize} teamLogo={teamLogo} disableHoverScale />
        </div>
      </div>
      <div
        className="absolute pointer-events-none flex justify-center"
        style={{ left: 0, right: 0, bottom: "4%", zIndex: 3 }}
      >
        <img
          src="/images/logo-horizontal.png"
          alt="FAIRGROUND"
          style={{ height: visualLogoHeight, opacity: 0.9 }}
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 60% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)" }}
      />
    </div>
  );
}
