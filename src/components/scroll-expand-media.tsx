"use client";

import { useRef, ReactNode } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface ScrollExpandMediaProps {
  mediaType?: "video" | "image";
  mediaSrc: string;
  posterSrc?: string;
  bgImageSrc?: string;
  title?: string;
  date?: string;
  scrollToExpand?: string;
  textBlend?: boolean;
  children?: ReactNode;
}

export function ScrollExpandMedia({
  mediaType = "video",
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand = "스크롤하여 시작하기",
  textBlend = false,
  children,
}: ScrollExpandMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth spring for scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    restDelta: 0.001,
  });

  // Media expands: small card → full viewport
  const mediaWidth = useTransform(smoothProgress, [0, 0.7], ["min(500px, 90vw)", "100vw"]);
  const mediaHeight = useTransform(smoothProgress, [0, 0.7], ["min(400px, 60vh)", "100vh"]);
  const borderRadius = useTransform(smoothProgress, [0, 0.7], [20, 0]);

  // Title words split apart
  const titleLeftX = useTransform(smoothProgress, [0, 0.4], [0, -300]);
  const titleRightX = useTransform(smoothProgress, [0, 0.4], [0, 300]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.35], [1, 0]);

  // Scroll hint fades quickly
  const hintOpacity = useTransform(smoothProgress, [0, 0.15], [1, 0]);

  // Box shadow fades out as media expands
  const shadowOpacity = useTransform(smoothProgress, [0, 0.6], [1, 0]);

  // CTA children appear when nearly full screen
  const childrenOpacity = useTransform(smoothProgress, [0.7, 0.9], [0, 1]);
  const childrenY = useTransform(smoothProgress, [0.7, 0.9], [24, 0]);

  // Background overlay fades out
  const bgOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);
  const bgImageOpacity = useTransform(smoothProgress, [0, 0.5], [0.4, 0]);

  const titleWords = title ? title.split(" ") : [];
  const firstWord = titleWords[0] ?? "";
  const restWords = titleWords.slice(1).join(" ");

  return (
    // Outer container: tall enough to create scroll space
    <div ref={containerRef} style={{ height: "250vh" }}>
      {/* Sticky inner: stays fixed while scrolling through the outer */}
      <div
        className="sticky top-0 flex items-center justify-center overflow-hidden"
        style={{ height: "100vh", background: "#0D1B2A" }}
      >
        {/* Grid pattern */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(0,200,83,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,83,0.04) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            opacity: bgOpacity,
          }}
        />

        {/* Background image */}
        {bgImageSrc && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ opacity: bgImageOpacity }}
          >
            <Image src={bgImageSrc} alt="background" fill className="object-cover" priority />
          </motion.div>
        )}

        {/* Title — splits apart on scroll */}
        {title && (
          <div
            className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
          >
            <motion.div
              className="flex items-baseline gap-0 font-black select-none"
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "clamp(64px, 12vw, 160px)",
                letterSpacing: "-4px",
                opacity: titleOpacity,
              }}
            >
              <motion.span
                style={{ color: "#FAFCFF", x: titleLeftX, display: "inline-block" }}
              >
                {firstWord}
              </motion.span>
              {restWords && (
                <motion.span
                  style={{ color: "#00C853", x: titleRightX, display: "inline-block" }}
                >
                  {restWords}
                </motion.span>
              )}
            </motion.div>
          </div>
        )}

        {/* Expanding media */}
        <motion.div
          className="relative overflow-hidden z-10"
          style={{
            width: mediaWidth,
            height: mediaHeight,
            borderRadius,
          }}
        >
          {/* Shadow ring */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
              opacity: shadowOpacity,
              borderRadius,
            }}
          />

          {mediaType === "video" ? (
            <video
              src={mediaSrc}
              poster={posterSrc}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <Image
              src={mediaSrc}
              alt={title ?? "media"}
              fill
              className="object-cover"
              priority
            />
          )}

          {/* Bottom gradient */}
          <div
            className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none z-10"
            style={{
              background: "linear-gradient(to top, rgba(13,27,42,0.85) 0%, transparent 100%)",
            }}
          />

          {/* CTA children */}
          {children && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-4 pb-14 z-20"
              style={{ opacity: childrenOpacity, y: childrenY }}
            >
              {children}
            </motion.div>
          )}
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none z-30"
          style={{ opacity: hintOpacity }}
        >
          {date && (
            <p
              className="text-xs tracking-[3px] uppercase"
              style={{ fontFamily: "var(--font-space-mono)", color: "#627D98" }}
            >
              {date}
            </p>
          )}
          <p
            className="text-xs tracking-[2px]"
            style={{ fontFamily: "var(--font-space-mono)", color: "#627D98" }}
          >
            {scrollToExpand}
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
    </div>
  );
}
