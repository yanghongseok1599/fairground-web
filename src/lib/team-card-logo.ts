// The light-ink variant belongs to this club's dark card surface only.
// Keep its uploaded logo intact for white backgrounds and future editing.
export const BOB_FS_TEAM_ID = "5f085bcc-69df-4be9-9b2d-7224e627f1eb";

export function needsLightTeamCardLogo(teamId?: string) {
  return teamId === BOB_FS_TEAM_ID;
}

/** Preserve alpha and colored accents; replace only dark, near-neutral ink. */
export function applyWhiteLogoInk(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (max <= 96 && max - min <= 24) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    }
  }
}

export function prepareTeamCardLogo(logo: HTMLImageElement, teamId?: string): HTMLImageElement | HTMLCanvasElement {
  if (!needsLightTeamCardLogo(teamId)) return logo;
  const canvas = document.createElement("canvas");
  canvas.width = logo.naturalWidth || logo.width;
  canvas.height = logo.naturalHeight || logo.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(logo, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyWhiteLogoInk(image.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}
