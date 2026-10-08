"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const HERO_MEDIA = {
  desktop: "/videos/fairground-home-main-20261008.mp4",
  mobile: "/videos/fairground-home-main-20261008-mobile.mp4",
  poster: "/videos/fairground-home-main-20261008.webp",
  mobilePoster: "/videos/fairground-home-main-20261008-mobile.webp",
};

type NetworkPreference = EventTarget & {
  saveData?: boolean;
  effectiveType?: string;
};

export function HomeVideoHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackChoice = useRef<boolean | null>(null);
  const reconcilePlayback = useRef<(() => void) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowScreen = window.matchMedia("(max-width: 767px)").matches;
    const connection = (navigator as Navigator & { connection?: NetworkPreference }).connection;
    let isVisible = false;

    video.muted = true;
    video.defaultMuted = true;
    video.poster = narrowScreen ? HERO_MEDIA.mobilePoster : HERO_MEDIA.poster;

    const syncPlayback = () => {
      const limitsAutoplay =
        reducedMotion.matches ||
        connection?.saveData === true ||
        connection?.effectiveType === "2g" ||
        connection?.effectiveType === "slow-2g";
      const wantsPlayback = playbackChoice.current ?? !limitsAutoplay;

      if (!isVisible || document.hidden || !wantsPlayback) {
        video.pause();
        return;
      }

      // Defer the video request until it is visible and motion is permitted.
      if (!video.hasAttribute("src")) {
        video.src = narrowScreen ? HERO_MEDIA.mobile : HERO_MEDIA.desktop;
      } else if (video.error) {
        video.load();
      }

      video.muted = true;
      if (video.paused) {
        // Some browsers require a gesture; the visible play button retries it.
        void video.play().catch(() => {});
      }
    };

    reconcilePlayback.current = syncPlayback;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        syncPlayback();
      },
      { threshold: 0.05 },
    );
    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
    connection?.addEventListener("change", syncPlayback);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
      connection?.removeEventListener("change", syncPlayback);
      reconcilePlayback.current = null;
      video.pause();
    };
  }, []);

  function togglePlayback() {
    playbackChoice.current = !isPlaying;
    reconcilePlayback.current?.();
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black md:aspect-[21/9]">
      <video
        ref={videoRef}
        id="home-hero-video"
        width={1920}
        height={1080}
        className="block h-full w-full object-cover object-center"
        poster={HERO_MEDIA.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        aria-label="페어그라운드 대회 하이라이트"
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      >
        페어그라운드 대회 하이라이트 영상입니다.
      </video>
      <button
        type="button"
        className="absolute right-3 bottom-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:right-5 md:bottom-5"
        onClick={togglePlayback}
        aria-label={isPlaying ? "영상 일시정지" : "영상 재생"}
        aria-controls="home-hero-video"
        title={isPlaying ? "영상 일시정지" : "영상 재생"}
      >
        {isPlaying ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
      </button>
    </div>
  );
}
