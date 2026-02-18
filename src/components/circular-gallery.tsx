"use client";

import React, { useState, useEffect, useRef, HTMLAttributes } from "react";

const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

export interface GalleryItem {
  id?: string;
  common: string;
  binomial: string;
  photo: {
    url: string;
    text: string;
    pos?: string;
    by: string;
  };
  colorIndex?: number;
}

const CARD_COLORS = [
  { from: "#00C853", to: "#004D20" },
  { from: "#4FC3F7", to: "#0D47A1" },
  { from: "#FFD700", to: "#7B5800" },
  { from: "#FF6B6B", to: "#7B1A1A" },
  { from: "#CE93D8", to: "#4A148C" },
  { from: "#FFA726", to: "#7B3F00" },
  { from: "#69F0AE", to: "#004D30" },
  { from: "#42A5F5", to: "#0D2A5C" },
  { from: "#FF80AB", to: "#7B0045" },
  { from: "#00E676", to: "#004D2A" },
];

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[];
  radius?: number;
  autoRotateSpeed?: number;
  onItemClick?: (item: GalleryItem, index: number) => void;
  selectedId?: string;
}

const CircularGallery = React.forwardRef<HTMLDivElement, CircularGalleryProps>(
  (
    {
      items,
      className,
      radius = 600,
      autoRotateSpeed = 0.3,
      onItemClick,
      selectedId,
      ...props
    },
    ref
  ) => {
    const [rotation, setRotation] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
      const handleScroll = () => {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        const scrollableHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress =
          scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        setRotation(scrollProgress * 360);
        scrollTimeoutRef.current = setTimeout(
          () => setIsScrolling(false),
          150
        );
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      };
    }, []);

    useEffect(() => {
      const autoRotate = () => {
        if (!isScrolling) {
          setRotation((prev) => prev + autoRotateSpeed);
        }
        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };
      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);
      };
    }, [isScrolling, autoRotateSpeed]);

    const anglePerItem = 360 / items.length;

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Circular 3D Gallery"
        className={cn(
          "relative w-full h-full flex items-center justify-center",
          className
        )}
        style={{ perspective: "2000px" }}
        {...props}
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `rotateY(${rotation}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {items.map((item, i) => {
            const itemAngle = i * anglePerItem;
            const totalRotation = rotation % 360;
            const relativeAngle =
              (itemAngle + totalRotation + 360) % 360;
            const normalizedAngle = Math.abs(
              relativeAngle > 180 ? 360 - relativeAngle : relativeAngle
            );
            const opacity = Math.max(0.25, 1 - normalizedAngle / 180);
            const isSelected = selectedId === item.id;
            const colorIdx = (item.colorIndex ?? i) % CARD_COLORS.length;
            const color = CARD_COLORS[colorIdx];

            return (
              <div
                key={item.id ?? item.photo.url ?? i}
                role="group"
                aria-label={item.common}
                className="absolute w-[220px] h-[300px] cursor-pointer"
                style={{
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  left: "50%",
                  top: "50%",
                  marginLeft: "-110px",
                  marginTop: "-150px",
                  opacity,
                  transition: "opacity 0.3s linear",
                }}
                onClick={() => onItemClick?.(item, i)}
              >
                <div
                  className="relative w-full h-full rounded-2xl overflow-hidden group"
                  style={{
                    boxShadow: isSelected
                      ? `0 0 0 3px ${color.from}, 0 8px 32px rgba(0,0,0,0.6)`
                      : "0 8px 32px rgba(0,0,0,0.5)",
                    border: `1px solid ${isSelected ? color.from : "rgba(255,255,255,0.1)"}`,
                    transition: "box-shadow 0.3s, border-color 0.3s",
                  }}
                >
                  {item.photo.url ? (
                    <img
                      src={item.photo.url}
                      alt={item.photo.text}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{
                        objectPosition: item.photo.pos ?? "center",
                      }}
                    />
                  ) : (
                    /* 로고 없는 팀: 브랜드 그라데이션 + 이니셜 */
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${color.from}33 0%, #0D1B2A 60%)`,
                      }}
                    >
                      <span
                        className="font-black select-none"
                        style={{
                          fontSize: 64,
                          color: color.from,
                          letterSpacing: "-4px",
                          textShadow: `0 0 40px ${color.from}66`,
                          fontFamily: "var(--font-outfit)",
                        }}
                      >
                        {item.common.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Bottom info bar */}
                  <div
                    className="absolute bottom-0 left-0 w-full p-4"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(13,27,42,0.95) 0%, rgba(13,27,42,0.6) 70%, transparent 100%)",
                    }}
                  >
                    <h2
                      className="font-bold text-base leading-tight"
                      style={{
                        color: "#FAFCFF",
                        fontFamily: "var(--font-outfit)",
                        letterSpacing: "-0.5px",
                      }}
                    >
                      {item.common}
                    </h2>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: color.from }}
                    >
                      {item.binomial}
                    </p>
                    {item.photo.by && (
                      <p
                        className="text-xs mt-1 opacity-50"
                        style={{
                          color: "#D9E2EC",
                          fontFamily: "var(--font-space-mono)",
                        }}
                      >
                        {item.photo.by}
                      </p>
                    )}
                  </div>

                  {/* Selected ring overlay */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 pointer-events-none rounded-2xl"
                      style={{
                        boxShadow: `inset 0 0 0 2px ${color.from}`,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

CircularGallery.displayName = "CircularGallery";
export { CircularGallery };
