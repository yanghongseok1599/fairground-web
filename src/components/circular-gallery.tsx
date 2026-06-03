"use client";

import React, { useEffect, useRef, HTMLAttributes } from "react";
import { ClubEmblem } from "@/components/club-emblem";

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
  { from: "#2F80ED", to: "#0B1F47", paper: "#F7FBFF" },
  { from: "#FF5A5F", to: "#23141B", paper: "#FFF3F0" },
  { from: "#00C48C", to: "#073B32", paper: "#ECFFF8" },
  { from: "#F7C948", to: "#201609", paper: "#FFF9E6" },
  { from: "#FF8A00", to: "#2A1605", paper: "#FFF0DA" },
  { from: "#5B8DEF", to: "#071E49", paper: "#EDF5FF" },
  { from: "#9B5CFF", to: "#101333", paper: "#F4EDFF" },
  { from: "#18D5FF", to: "#072B3A", paper: "#EAFBFF" },
  { from: "#F05D7B", to: "#260912", paper: "#FFF0F5" },
  { from: "#2DD4BF", to: "#082F2C", paper: "#EFFFFB" },
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
    const stageRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
    const rotationRef = useRef(0);
    const isHoveringRef = useRef(false);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragStartRotationRef = useRef(0);
    const dragDistanceRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const anglePerItem = 360 / items.length;

    useEffect(() => {
      const autoRotate = () => {
        if (!isHoveringRef.current && !isDraggingRef.current) {
          rotationRef.current += autoRotateSpeed;
        }

        if (stageRef.current) {
          stageRef.current.style.transform = `rotateY(${rotationRef.current}deg)`;
        }

        for (let i = 0; i < itemRefs.current.length; i += 1) {
          const el = itemRefs.current[i];
          if (!el) continue;
          const itemAngle = i * anglePerItem;
          const relativeAngle = (itemAngle + rotationRef.current + 360) % 360;
          const normalizedAngle = Math.abs(
            relativeAngle > 180 ? 360 - relativeAngle : relativeAngle
          );
          el.style.opacity = String(Math.max(0.25, 1 - normalizedAngle / 180));
        }

        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };
      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current)
          cancelAnimationFrame(animationFrameRef.current);
      };
    }, [anglePerItem, autoRotateSpeed]);

    useEffect(() => {
      const handlePointerMove = (event: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = event.clientX - dragStartXRef.current;
        dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(dx));
        rotationRef.current = dragStartRotationRef.current + dx * 0.35;
      };

      const handlePointerUp = () => {
        isDraggingRef.current = false;
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };
    }, []);

    return (
      <div
        ref={ref}
        role="region"
        aria-label="Circular 3D Gallery"
        className={cn(
          "relative w-full h-full flex items-center justify-center touch-pan-y",
          className
        )}
        style={{ perspective: "2000px" }}
        onPointerEnter={() => {
          isHoveringRef.current = true;
        }}
        onPointerLeave={() => {
          isHoveringRef.current = false;
        }}
        onPointerDown={(event) => {
          isDraggingRef.current = true;
          dragDistanceRef.current = 0;
          dragStartXRef.current = event.clientX;
          dragStartRotationRef.current = rotationRef.current;
        }}
        {...props}
      >
        <div
          ref={stageRef}
          className="relative w-full h-full"
          style={{
            transform: "rotateY(0deg)",
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {items.map((item, i) => {
            const itemAngle = i * anglePerItem;
            const relativeAngle = (itemAngle + 360) % 360;
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
                ref={(element) => {
                  itemRefs.current[i] = element;
                }}
                role="group"
                aria-label={item.common}
                className="absolute h-[260px] w-[260px] cursor-pointer"
                style={{
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  left: "50%",
                  top: "50%",
                  marginLeft: "-130px",
                  marginTop: "-130px",
                  opacity,
                  transition: "opacity 0.16s linear",
                  willChange: "opacity, transform",
                }}
                onClick={() => {
                  if (dragDistanceRef.current < 8) onItemClick?.(item, i);
                }}
              >
                <div
                  className="group relative flex h-full w-full flex-col items-center justify-center"
                  style={{
                    transform: `scale(${isSelected ? 1.08 : 1})`,
                    transition: "transform 0.3s ease",
                  }}
                >
                  <div
                    className="absolute left-1/2 top-[44%] h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(circle, ${color.from}55 0%, transparent 68%)`,
                    }}
                  />
                  <div
                    className="relative flex h-[190px] w-[190px] items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{
                      filter: `drop-shadow(0 22px 26px rgba(13,27,42,0.28)) drop-shadow(0 0 20px ${color.from}48)`,
                    }}
                  >
                    <ClubEmblem name={item.common} logoSrc={item.photo.url} index={i} className="h-full w-full p-3" />
                  </div>
                  <div
                    className="mt-3 max-w-[190px] truncate text-center text-sm font-black tracking-[-0.01em]"
                    style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-outfit)" }}
                  >
                    {item.common}
                  </div>

                  {isSelected && (
                    <div
                      className="pointer-events-none absolute left-1/2 top-[44%] h-[210px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        boxShadow: `0 0 0 2px ${color.from}, 0 0 34px ${color.from}66`,
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
