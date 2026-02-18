"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Team } from "@/types";

const CARD_COLORS = [
  "#00C853", "#4FC3F7", "#FFD700", "#FF6B6B", "#CE93D8",
  "#FFA726", "#69F0AE", "#42A5F5", "#FF80AB", "#00E676",
];

interface TeamCarouselProps {
  teams: Team[];
  selectedId?: string | null;
  onSelect: (team: Team) => void;
}

export function TeamCarousel({ teams, selectedId, onSelect }: TeamCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(Math.floor(teams.length / 2));

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % teams.length);
  }, [teams.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + teams.length) % teams.length);
  };

  React.useEffect(() => {
    if (selectedId) return;
    const timer = setInterval(handleNext, 4000);
    return () => clearInterval(timer);
  }, [handleNext, selectedId]);

  const handleCardClick = (index: number) => {
    if (index === currentIndex) {
      onSelect(teams[index]);
    } else {
      setCurrentIndex(index);
    }
  };

  return (
    <div className="relative w-full h-[440px] flex items-center justify-center" style={{ perspective: "1400px" }}>
      {teams.map((team, index) => {
        const total = teams.length;
        let pos = ((index - currentIndex) + total) % total;
        if (pos > Math.floor(total / 2)) pos = pos - total;

        const isCenter = pos === 0;
        const isAdjacent = Math.abs(pos) === 1;
        const color = CARD_COLORS[index % CARD_COLORS.length];
        const isSelected = team.id === selectedId;

        return (
          <div
            key={team.id}
            className="absolute transition-all duration-500 ease-in-out cursor-pointer select-none"
            style={{
              width: "300px",
              height: "420px",
              transform: `translateX(${pos * 44}%) scale(${isCenter ? 1 : isAdjacent ? 0.78 : 0.62}) rotateY(${pos * -12}deg)`,
              zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
              opacity: isCenter ? 1 : isAdjacent ? 0.45 : 0,
              filter: isCenter ? "blur(0px)" : "blur(3px)",
              visibility: Math.abs(pos) > 2 ? "hidden" : "visible",
            }}
            onClick={() => handleCardClick(index)}
          >
            <div
              className="w-full h-full rounded-3xl flex flex-col items-center justify-center gap-5 p-8 transition-all"
              style={{
                background: isCenter && isSelected
                  ? "#0D1B2A"
                  : `linear-gradient(145deg, ${color}20 0%, rgba(255,255,255,0.04) 100%)`,
                border: `2px solid ${isCenter && isSelected ? color : `${color}50`}`,
                boxShadow: isCenter
                  ? isSelected
                    ? `0 0 0 2px ${color}40, 0 24px 60px ${color}35`
                    : `0 24px 60px rgba(0,0,0,0.25)`
                  : "none",
              }}
            >
              {/* Logo */}
              <div
                className="w-36 h-36 rounded-2xl flex items-center justify-center font-black text-4xl"
                style={{
                  background: team.logo ? "transparent" : `linear-gradient(135deg, ${color}35 0%, ${color}10 100%)`,
                  border: `1.5px solid ${color}60`,
                }}
              >
                {team.logo ? (
                  <img src={team.logo} alt={team.name} className="w-full h-full object-contain rounded-2xl" />
                ) : (
                  <span style={{ color, fontFamily: "var(--font-outfit)", letterSpacing: "-2px" }}>
                    {team.name.slice(0, 2)}
                  </span>
                )}
              </div>

              {/* Name */}
              <p
                className="text-lg font-bold text-center leading-tight"
                style={{ color: "#FAFCFF", fontFamily: "var(--font-outfit)" }}
              >
                {team.name}
              </p>
              <p className="text-xs" style={{ color: "#627D98", fontFamily: "var(--font-space-mono)" }}>
                {team.memberCount}명
              </p>

              {isCenter && (
                <p
                  className="text-[9px] font-bold tracking-wide"
                  style={{ color, fontFamily: "var(--font-space-mono)" }}
                >
                  {isSelected ? "▼ 선수 보기" : "▶ 클릭"}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Nav buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80"
        style={{ background: "rgba(13,27,42,0.7)", border: "1px solid rgba(0,200,83,0.3)", color: "#D9E2EC" }}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-80"
        style={{ background: "rgba(13,27,42,0.7)", border: "1px solid rgba(0,200,83,0.3)", color: "#D9E2EC" }}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
