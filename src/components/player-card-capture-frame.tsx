"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerCard } from "@/components/player-card";
import {
  PLAYER_CARD_COMPOSITION,
  PLAYER_CARD_PRESET_ID,
  PLAYER_CARD_WIDTH_PX,
  type PlayerCardAppearance,
} from "@/lib/player-card-frame";
import type { Player } from "@/types";
import type { PlayerCardContext } from "@/lib/player-card-skin";

interface PlayerCardCaptureFrameProps {
  player: Player;
  teamLogo?: string;
  displayWidth?: number | string;
  className?: string;
  cardContext?: PlayerCardContext;
  appearance?: PlayerCardAppearance;
}

/** 화면과 PNG 모두 이 캔버스를 사용한다. 배경은 항상 투명하다. */
export function PlayerCardCaptureFrame({
  player,
  teamLogo,
  displayWidth = "100%",
  className = "",
  cardContext = "league",
  appearance = "rating",
}: PlayerCardCaptureFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(0);
  const composition = PLAYER_CARD_COMPOSITION;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateSize = () => setRenderedWidth(frame.getBoundingClientRect().width);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      data-player-card-export-preset={PLAYER_CARD_PRESET_ID}
      className={`relative overflow-hidden ${className}`}
      style={{
        width: displayWidth,
        maxWidth: "100%",
        aspectRatio: `${composition.width} / ${composition.height}`,
      }}
    >
      <div
        data-player-card-composition
        className="absolute left-0 top-0"
        style={{
          width: composition.width,
          height: composition.height,
          transform: `scale(${renderedWidth / composition.width})`,
          transformOrigin: "top left",
        }}
      >
        <div
          className="absolute"
          style={{
            left: composition.card.x,
            top: composition.card.y,
            transform: `scale(${composition.card.width / PLAYER_CARD_WIDTH_PX.export})`,
            transformOrigin: "top left",
          }}
        >
          <PlayerCard player={player} cardContext={cardContext} appearance={appearance} size="export" teamLogo={teamLogo} disableHoverScale />
        </div>
        <img
          src={composition.wordmark.src}
          alt="FAIRGROUND"
          className="absolute"
          style={{
            left: composition.wordmark.x,
            top: composition.wordmark.y,
            width: composition.wordmark.width,
            height: "auto",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
