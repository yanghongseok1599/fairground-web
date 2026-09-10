import { getUpperBodyPortraitStyles } from "@/lib/player-card/upper-body-portrait";

/** Shared by registration preview, player cards and card exports; no re-upload required. */
export function UpperBodyPortrait({ src, alt = "", scale = 1, offsetX = 0, shadow = false }: {
  src: string;
  alt?: string;
  scale?: number;
  offsetX?: number;
  shadow?: boolean;
}) {
  const styles = getUpperBodyPortraitStyles(scale, offsetX, shadow);
  return (
    <div style={styles.frame} data-player-portrait="upper-body">
      <div style={styles.crop}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} aria-hidden={alt ? undefined : true} draggable={false} style={styles.image} />
      </div>
    </div>
  );
}
