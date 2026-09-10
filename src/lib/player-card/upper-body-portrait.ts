import type { CSSProperties } from "react";

/** Display-only crop: retain original saved photos and hide the lower body. */
export const UPPER_BODY_VISIBLE_FRACTION = 0.72;

/** Public profiles omit private gender data: missing gender must not add a shadow. */
export function shouldShowPlayerPortraitShadow(gender?: string): boolean {
  return gender === "male";
}

export function getUpperBodyPortraitStyles(scale = 1, offsetX = 0, shadow = false): Record<"frame" | "crop" | "image", CSSProperties> {
  const safeScale = Number.isFinite(scale) ? Math.min(2.5, Math.max(0.5, scale)) : 1;
  const safeOffset = Number.isFinite(offsetX) ? offsetX : 0;
  return {
    frame: { position: "relative", width: "100%", height: "100%", overflow: "hidden" },
    // Crop BEFORE user zoom, then keep its lower edge on the card's divider.
    // A top origin leaves a gap below the torso at the default 92% scale.
    crop: { position: "absolute", inset: 0, overflow: "hidden", transform: `scale(${safeScale})`, transformOrigin: "center bottom" },
    image: {
      position: "absolute", top: 0, left: "50%", display: "block", width: "auto",
      height: `${100 / UPPER_BODY_VISIBLE_FRACTION}%`, maxWidth: "none",
      transform: `translateX(calc(-50% + ${safeOffset}%))`,
      filter: shadow ? "drop-shadow(0 8px 10px rgba(0,0,0,0.28))" : undefined,
    },
  };
}
