import type { Gender } from "@/types";
import { getTeamlessPlayerCardPose } from "@/lib/player-card-pose-templates";
import { detectCardFace } from "@/lib/player-card/face-landmarks";
import { alignWholeHead, headBounds, transformHeadPoint } from "@/lib/player-card/head-geometry";
import { createWholeHeadCutout, createUniformBodyCutout } from "@/lib/player-card/head-segmentation";

interface ComposeTeamlessPosePhotoOptions {
  sourcePhoto: Blob;
  gender?: Gender | null;
  seed?: string;
  templateSrc?: string;
  mimeType?: "image/webp" | "image/png";
  quality?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다. 다시 시도해주세요."));
    image.src = src;
  });
}

export async function composeTeamlessPoseCardPhoto({
  sourcePhoto, gender, seed, templateSrc, mimeType = "image/webp", quality = 0.92,
}: ComposeTeamlessPosePhotoOptions): Promise<Blob> {
  const sourceUrl = URL.createObjectURL(sourcePhoto);
  try {
    const [source, template] = await Promise.all([
      loadImage(sourceUrl), loadImage(templateSrc ?? getTeamlessPlayerCardPose(gender, seed).src),
    ]);
    const sourcePoints = (await detectCardFace(source)).map((p) => ({ x: p.x * source.naturalWidth, y: p.y * source.naturalHeight }));
    const targetPoints = (await detectCardFace(template)).map((p) => ({ x: p.x * template.naturalWidth, y: p.y * template.naturalHeight }));
    const transform = alignWholeHead(sourcePoints, targetPoints);
    const cutout = await createWholeHeadCutout(source, sourcePoints);
    const body = await createUniformBodyCutout(template);
    const bounds = headBounds(targetPoints);
    // Add headroom for tall hairstyles rather than clipping to the old model's frame.
    const corners = [
      { x: cutout.left, y: cutout.top }, { x: cutout.left + cutout.canvas.width, y: cutout.top },
    ].map((p) => transformHeadPoint(p, transform));
    const padding = Math.max(0, Math.ceil(12 - Math.min(...corners.map((p) => p.y))));
    const canvas = document.createElement("canvas");
    canvas.width = template.naturalWidth; canvas.height = template.naturalHeight + padding;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("선수카드용 이미지 생성에 실패했습니다.");
    context.drawImage(body, 0, padding);
    // Delete the original head entirely, including hair, ears and headband.
    // Juntas production templates have short hair entirely above this neck seam.
    context.clearRect(0, 0, canvas.width, padding + bounds.bottom + 1);
    context.setTransform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5] + padding);
    context.drawImage(cutout.canvas, cutout.left, cutout.top);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("선수카드용 이미지 생성에 실패했습니다."));
    }, mimeType, quality));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
