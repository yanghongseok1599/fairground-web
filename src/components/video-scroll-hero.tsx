"use client";

import React, { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface VideoScrollHeroProps {
  videoSrc?: string;
  enableAnimations?: boolean;
  className?: string;
  startScale?: number;
  children?: ReactNode;
}

export function VideoScrollHero({
  videoSrc = "/FairGroundAd.mp4",
  enableAnimations = true,
  className = "",
  startScale = 0.25,
  children,
}: VideoScrollHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [scrollScale, setScrollScale] = useState(startScale);

  useEffect(() => {
    if (!enableAnimations || shouldReduceMotion) return;

    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRef.current.offsetHeight;
      const windowHeight = window.innerHeight;

      const scrolled = Math.max(0, -rect.top);
      const maxScroll = containerHeight - windowHeight;
      const progress = Math.min(scrolled / maxScroll, 1);

      const newScale = startScale + progress * (1 - startScale);
      setScrollScale(newScale);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [enableAnimations, shouldReduceMotion, startScale]);

  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const isExpanded = scrollScale > 0.95;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="relative h-[200vh]"
        style={{ background: "#0D1B2A" }}
      >
        {/* Sticky video container */}
        <div className="sticky top-0 w-full h-screen flex items-center justify-center z-10 overflow-hidden">
          {/* Grid background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(0,200,83,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.04) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              opacity: 1 - scrollScale,
            }}
          />

          <div
            className="relative flex items-center justify-center will-change-transform"
            style={{
              transform: shouldAnimate ? `scale(${scrollScale})` : "scale(1)",
              transformOrigin: "center center",
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-[80vw] max-w-5xl h-[60vh] object-cover shadow-2xl"
              style={{
                borderRadius: isExpanded ? 0 : 16,
                transition: "border-radius 0.2s",
              }}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>

            {/* Bottom gradient */}
            <div
              className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
              style={{
                background: "linear-gradient(to top, rgba(13,27,42,0.85) 0%, transparent 100%)",
              }}
            />

            {/* Overlay: scroll hint + CTA */}
            <div className="absolute inset-0 flex flex-col items-center justify-end py-12 pointer-events-none">
              {/* Scroll hint — visible when small */}
              <motion.div
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: isExpanded ? 0 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <p
                  className="text-xs tracking-[2px]"
                  style={{ fontFamily: "var(--font-space-mono)", color: "rgba(217,226,236,0.5)" }}
                >
                  스크롤하여 시작하기
                </p>
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 3 L10 13 M10 13 L5 9 M10 13 L15 9"
                      stroke="rgba(0,200,83,0.6)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </motion.div>
            </div>

            {/* CTA buttons — appear when expanded */}
            {children && (
              <motion.div
                className="absolute bottom-14 left-0 right-0 flex flex-wrap items-center justify-center gap-4 pointer-events-auto"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: isExpanded ? 1 : 0, y: isExpanded ? 0 : 16 }}
                transition={{ duration: 0.4 }}
              >
                {children}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
