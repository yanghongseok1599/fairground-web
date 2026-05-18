"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";

/**
 * A single reveal that fades in/out over a window of the overall scroll progress.
 * - `range`: [start, end] both in 0..1 of the scroll-scrub range.
 * - `fadeIn` / `fadeOut`: fraction of the range spent on fading. Defaults 0.2 each.
 *   Set `fadeOut: 0` for a reveal that sticks at full opacity through the end of its range.
 * - `translate`: pixels of Y translate applied symmetrically (+ at fade-in start, − at fade-out end).
 */
export interface HeroReveal {
  content: React.ReactNode;
  range: [number, number];
  fadeIn?: number;
  fadeOut?: number;
  translate?: number;
}

/**
 * Decides whether the scroll-scrubbed canvas should run at all.
 * Skips when the user prefers reduced motion, has Save-Data / a slow
 * connection, or is on a narrow mobile viewport — in those cases a static
 * poster + DOM copy is shown instead (§5 motion gate, WCAG 2.3.3).
 */
function shouldUseStaticHero(): boolean {
  if (typeof window === "undefined") return false;
  const reduced =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  const saveData = conn?.saveData === true;
  const slow =
    conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g";
  const narrow = window.innerWidth < 768;
  return reduced || saveData || slow || narrow;
}

interface ScrollVideoHeroProps {
  /** Total frames available in /public/hero-seq/frame-NNN.webp */
  frameCount?: number;
  /** File prefix in /public/hero-seq/ */
  framePrefix?: string;
  /** zero-padded digits (frame-001 → 3) */
  pad?: number;
  /** Poster image for instant paint + LCP */
  poster?: string;
  /** Optional foreground content (overlay) rendered above the canvas. */
  children?: React.ReactNode;
  /** How tall the scroll region is, in viewport heights. 2 = scroll 2 screen-heights to play through. */
  scrollLength?: number;
  /** "cover" crops to fill. "contain" letterboxes within the stage. Default "cover". */
  fit?: "cover" | "contain";
  /** Canvas aspect ratio (width / height). Used when fit = "contain" and you want the stage to match. */
  aspect?: number;
  /** Background behind the canvas (visible when letterboxing). */
  background?: string;
  /** Sticky `top` in px — usually the height of a fixed header so the hero pins immediately. */
  stickyTop?: number;
  /** Reveals that fade in/out as the user scrolls through the pinned range. */
  reveals?: HeroReveal[];
  /**
   * Content shown over the static poster when motion is gated
   * (reduced-motion / Save-Data / slow connection / narrow mobile).
   * Rendered in real DOM so screen readers and crawlers always reach it.
   */
  staticFallback?: React.ReactNode;
}

/**
 * Preloads a WebP frame sequence and scrubs the current frame on a <canvas>
 * as the user scrolls. The canvas stays sticky while the outer scroll region
 * is taller than the viewport, giving the "play on scroll" effect. Children
 * are composited on top of the canvas.
 */
export function ScrollVideoHero({
  frameCount = 96,
  framePrefix = "/hero-seq/frame-",
  pad = 3,
  poster = "/hero-poster.webp",
  children,
  scrollLength = 2,
  fit = "cover",
  aspect,
  background = "#ffffff",
  stickyTop = 0,
  reveals = [],
  staticFallback,
}: ScrollVideoHeroProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<(HTMLImageElement | null)[]>([]);
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(-1);
  const [loaded, setLoaded] = useState(0);
  // Static mode is resolved on the client only (SSR renders the motion shell,
  // then we downgrade before any heavy work runs).
  const [staticMode, setStaticMode] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const evaluate = () => setStaticMode(shouldUseStaticHero());
    evaluate();
    setResolved(true);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", evaluate);
    window.addEventListener("resize", evaluate);
    return () => {
      mq?.removeEventListener?.("change", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  const frameUrl = (i: number) =>
    `${framePrefix}${String(i + 1).padStart(pad, "0")}.webp`;

  // Preload all frames into memory — skipped entirely in static mode so
  // gated users (reduced-motion / Save-Data / mobile) pay no frame bandwidth.
  useEffect(() => {
    if (!resolved || staticMode) return;
    framesRef.current = new Array(frameCount).fill(null);
    let cancelled = false;
    let loadedCount = 0;

    const loadOne = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (cancelled) return;
          framesRef.current[i] = img;
          loadedCount++;
          setLoaded(loadedCount);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameUrl(i);
      });

    // Load first frame ASAP (above-the-fold), then the rest in a few parallel lanes
    (async () => {
      await loadOne(0);
      if (cancelled) return;
      drawFrame(0); // paint first frame immediately
      const concurrency = 6;
      const queue = Array.from({ length: frameCount - 1 }, (_, k) => k + 1);
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length && !cancelled) {
          const idx = queue.shift();
          if (idx === undefined) return;
          await loadOne(idx);
        }
      });
      await Promise.all(workers);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount, framePrefix, pad, resolved, staticMode]);

  // Size canvas for the device pixel ratio
  const sizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Force redraw after resize
    if (lastFrameRef.current >= 0) drawFrame(lastFrameRef.current);
  };

  const drawFrame = (i: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = framesRef.current[i];
    if (!img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const ir = img.width / img.height;
    const cr = cw / ch;
    let dw = cw, dh = ch, dx = 0, dy = 0;
    if (fit === "contain") {
      // Letterbox inside the canvas — whole image visible
      if (ir > cr) {
        dw = cw;
        dh = cw / ir;
        dy = (ch - dh) / 2;
      } else {
        dh = ch;
        dw = ch * ir;
        dx = (cw - dw) / 2;
      }
    } else {
      // Cover — fill the canvas, cropping whichever axis is longer
      if (ir > cr) {
        dh = ch;
        dw = ch * ir;
        dx = (cw - dw) / 2;
      } else {
        dw = cw;
        dh = cw / ir;
        dy = (ch - dh) / 2;
      }
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
    lastFrameRef.current = i;
  };

  // Map scroll progress through the outer wrapper to a frame index
  useEffect(() => {
    if (!resolved || staticMode) return;
    sizeCanvas();
    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = outerRef.current;
        if (!el) return;
        const canvas = canvasRef.current;
        const rect = el.getBoundingClientRect();
        const stickyH = canvas?.getBoundingClientRect().height ?? window.innerHeight;
        const total = rect.height - stickyH;
        // Progress 0 → 1 as the sticky region scrolls past the viewport.
        // Accounts for `stickyTop` so the animation starts from scroll=0 even when
        // the sticky element is pinned below a fixed header.
        const progress = Math.min(1, Math.max(0, (stickyTop - rect.top) / Math.max(total, 1)));
        const target = Math.min(frameCount - 1, Math.round(progress * (frameCount - 1)));
        // Find the nearest loaded frame so we never render blank
        let idx = target;
        if (!framesRef.current[idx]) {
          for (let d = 1; d < frameCount; d++) {
            if (framesRef.current[idx - d]) { idx = idx - d; break; }
            if (framesRef.current[idx + d]) { idx = idx + d; break; }
          }
        }
        if (idx !== lastFrameRef.current) drawFrame(idx);

        // Drive reveal overlays — opacity + subtle vertical translate
        for (let i = 0; i < reveals.length; i++) {
          const r = reveals[i];
          const node = revealRefs.current[i];
          if (!node) continue;
          const [s, e] = r.range;
          const span = Math.max(e - s, 0.0001);
          const fi = Math.max(0, r.fadeIn ?? 0.2);
          const fo = Math.max(0, r.fadeOut ?? 0.2);
          const fiSpan = span * fi;
          const foSpan = span * fo;
          const translate = r.translate ?? 18;
          let opacity = 0;
          let ty = 0;
          if (progress < s) {
            opacity = 0;
            ty = translate;
          } else if (progress > e) {
            opacity = 0;
            ty = -translate;
          } else {
            const local = progress - s;
            if (local < fiSpan && fiSpan > 0) {
              const t = local / fiSpan;
              opacity = t;
              ty = translate * (1 - t);
            } else if (local > span - foSpan && foSpan > 0) {
              const t = (span - local) / foSpan;
              opacity = t;
              ty = -translate * (1 - t);
            } else {
              opacity = 1;
              ty = 0;
            }
          }
          node.style.opacity = String(opacity);
          node.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0)`;
        }
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount, resolved, staticMode]);

  const loadPct = Math.round((loaded / frameCount) * 100);

  // Static fallback: a single, non-scrolling stage with the poster behind
  // real-DOM copy. No canvas, no frame download, no scroll hijacking.
  if (resolved && staticMode) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{
          background,
          ...(aspect
            ? { width: "100%", aspectRatio: `${aspect}` }
            : { minHeight: `calc(100vh - ${stickyTop}px)` }),
        }}
      >
        <NextImage
          src={poster}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="absolute inset-0"
          style={{ objectFit: fit, background }}
        />
        {staticFallback && (
          <div className="relative h-full w-full flex items-center justify-center px-6">
            {staticFallback}
          </div>
        )}
      </div>
    );
  }

  const stickyStyle: React.CSSProperties = {
    top: stickyTop,
    background,
    // When aspect is given, stage is width-driven (fit width naturally).
    // Otherwise it fills the full viewport height.
    ...(aspect
      ? {
          width: "100%",
          aspectRatio: `${aspect}`,
          maxHeight: `calc(100dvh - ${stickyTop}px)`,
        }
      : {
          height: `calc(100vh - ${stickyTop}px)`,
          maxHeight: `calc(100dvh - ${stickyTop}px)`,
        }),
  };

  return (
    <div
      ref={outerRef}
      style={{ height: `${100 * scrollLength}vh` }}
      className="relative w-full"
    >
      {/* sticky stage: locks to the viewport for the full scroll region */}
      <div
        className="sticky left-0 overflow-hidden"
        style={stickyStyle}
      >
        {/* Poster underlay — shown until the first frame paints (LCP target) */}
        <NextImage
          src={poster}
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="absolute inset-0"
          style={{
            zIndex: 0,
            objectFit: fit,
            background,
          }}
        />
        {/* Canvas: the scrub target */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ zIndex: 1 }}
          aria-hidden
        />
        {/* Reveal overlays — fade in/out with scroll progress */}
        {reveals.length > 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
            {reveals.map((r, i) => (
              <div
                key={i}
                ref={(el) => { revealRefs.current[i] = el; }}
                className="absolute inset-0 flex items-center justify-center px-6"
                style={{
                  opacity: 0,
                  willChange: "opacity, transform",
                  transform: `translate3d(0, ${r.translate ?? 18}px, 0)`,
                }}
              >
                {r.content}
              </div>
            ))}
          </div>
        )}

        {/* Optional foreground content (empty by default) */}
        {children && (
          <div className="relative h-full w-full" style={{ zIndex: 4 }}>
            {children}
          </div>
        )}

        {/* Load indicator — bottom left, fades out when ready */}
        {loadPct < 100 && (
          <div
            className="absolute bottom-5 left-5 fg-label z-10 flex items-center gap-2"
            style={{ color: "#7A8496" }}
          >
            <span
              className="inline-block w-[6px] h-[6px] rounded-full animate-pulse-dot"
              style={{ background: "#1B5EFF" }}
            />
            LOADING {loadPct}%
          </div>
        )}
      </div>
    </div>
  );
}
