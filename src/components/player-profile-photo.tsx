"use client";

import type { LucideIcon } from "lucide-react";
import { UserCheck } from "lucide-react";

interface PlayerProfilePhotoProps {
  src?: string;
  alt: string;
  className?: string;
  icon?: LucideIcon;
}

export function PlayerProfilePhoto({
  src,
  alt,
  className = "h-14 w-14 rounded-full",
  icon: FallbackIcon = UserCheck,
}: PlayerProfilePhotoProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border ${className}`}
      style={{
        background: src
          ? "linear-gradient(180deg, #FFFFFF 0%, #EEF3FF 100%)"
          : "var(--color-fg-paper-3)",
        borderColor: "rgba(0,71,171,0.18)",
        color: "var(--primary)",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain object-center"
        />
      ) : (
        <FallbackIcon className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
