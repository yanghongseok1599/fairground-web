"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Native fullscreen is optional. iPhone keeps the same viewport-sized UI without rotating it. */
export function useRecordingFullscreen() {
  const [open, setOpen] = useState(false);
  const active = useRef(false);
  const ownsNative = useRef(false);

  const releaseNative = useCallback(() => {
    if (ownsNative.current && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
    ownsNative.current = false;
  }, []);

  const close = useCallback(() => {
    active.current = false;
    setOpen(false);
    releaseNative();
  }, [releaseNative]);

  const enter = () => {
    active.current = true;
    setOpen(true);
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    ownsNative.current = true;
    void document.documentElement.requestFullscreen().then(() => {
      // A slow native request must not reopen fullscreen after the user closed it.
      if (!active.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    }).catch(() => { ownsNative.current = false; });
  };

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onNativeChange = () => { if (ownsNative.current && !document.fullscreenElement) close(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) close();
    };
    document.addEventListener("fullscreenchange", onNativeChange);
    // Inspect before Radix handles Escape and marks its dialog as closed.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("fullscreenchange", onNativeChange);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);

  useEffect(() => () => { active.current = false; releaseNative(); }, [releaseNative]);
  return { open, enter, close };
}
