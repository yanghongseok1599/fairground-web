"use client";

import { ScanFace, Shirt } from "lucide-react";
import { PLAYER_CARD_PHOTO_OPTIONS, type PlayerCardPhotoMode } from "@/lib/player-card/photo-registration";

export function PlayerCardPhotoOptions({ onSelect, disabled }: {
  onSelect: (mode: PlayerCardPhotoMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 grid w-full max-w-[320px] gap-2" aria-label="사진 등록 방식">
      {PLAYER_CARD_PHOTO_OPTIONS.map(({ mode, label, description }) => {
        const Icon = mode === "face" ? ScanFace : Shirt;
        return (
          <button key={mode} type="button" disabled={disabled} onClick={() => onSelect(mode)}
            className="flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: mode === "face" ? "var(--primary)" : "var(--color-fg-paper)", borderColor: mode === "face" ? "var(--primary)" : "var(--color-fg-line-soft)", color: mode === "face" ? "white" : "var(--color-fg-ink)" }}>
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span><span className="block text-sm font-bold">{label}</span><span className="mt-0.5 block text-[11px] opacity-80">{description}</span></span>
          </button>
        );
      })}
    </div>
  );
}
