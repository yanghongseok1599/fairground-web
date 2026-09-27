import type { Gender } from "@/types";
import { getTeamlessPlayerCardPose } from "@/lib/player-card-pose-templates";
import { detectCardFace } from "@/lib/player-card/face-landmarks";
import { adjustHeadTransform, alignWholeHead, DEFAULT_HEAD_ADJUSTMENT, transformHeadPoint, type HeadAdjustment } from "@/lib/player-card/head-geometry";
import { createWholeHeadCutout, createUniformBodyCutout } from "@/lib/player-card/head-segmentation";

interface ComposeTeamlessPosePhotoOptions {
  sourcePhoto: Blob;
  gender?: Gender | null;
  seed?: string;
  templateSrc?: string;
  mimeType?: "image/webp" | "image/png";
  quality?: number;
}

export interface PreparedPlayerPortrait {
  render: (adjustment?: HeadAdjustment) => Promise<Blob>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다. 다시 시도해주세요."));
    image.src = src;
  });
}

export async function prepareTeamlessPoseCardPhoto({
  sourcePhoto, gender, seed, templateSrc, mimeType = "image/webp", quality = 0.92,
}: ComposeTeamlessPosePhotoOptions): Promise<PreparedPlayerPortrait> {
  const sourceUrl = URL.createObjectURL(sourcePhoto);
  try {
    const [source, template] = await Promise.all([
      loadImage(sourceUrl), loadImage(templateSrc ?? getTeamlessPlayerCardPose(gender, seed).src),
    ]);
    const sourcePoints = (await detectCardFace(source)).map((p) => ({ x: p.x * source.naturalWidth, y: p.y * source.naturalHeight }));
    const targetPoints = (await detectCardFace(template)).map((p) => ({ x: p.x * template.naturalWidth, y: p.y * template.naturalHeight }));
    const baseTransform = alignWholeHead(sourcePoints, targetPoints);
    const cutout = await createWholeHeadCutout(source, sourcePoints);
    const body = await createUniformBodyCutout(template, targetPoints);
    // Keep the same canvas while adjusting, so the body never jumps in the preview.
    const largest = adjustHeadTransform(baseTransform, targetPoints, { scale: 1.25, offsetX: 0, offsetY: -0.1 });
    const visible = cutout.visibleBounds;
    const corners = [
      { x: visible.left, y: visible.top }, { x: visible.right, y: visible.top },
      { x: visible.left, y: visible.bottom }, { x: visible.right, y: visible.bottom },
    ].map((p) => transformHeadPoint(p, largest));
    const padding = Math.max(0, Math.ceil(12 - Math.min(...corners.map((p) => p.y))));
    return { render: async (adjustment = DEFAULT_HEAD_ADJUSTMENT) => {
      const transform = adjustHeadTransform(baseTransform, targetPoints, adjustment);
      const canvas = document.createElement("canvas");
      canvas.width = template.naturalWidth; canvas.height = template.naturalHeight + padding;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("선수카드용 이미지 생성에 실패했습니다.");
      context.drawImage(body, 0, padding);
      context.setTransform(transform[0], transform[1], transform[2], transform[3], transform[4], transform[5] + padding);
      context.drawImage(cutout.canvas, cutout.left, cutout.top);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("선수카드용 이미지 생성에 실패했습니다."));
      }, mimeType, quality));
    } };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export async function composeTeamlessPoseCardPhoto(options: ComposeTeamlessPosePhotoOptions): Promise<Blob> {
  return (await prepareTeamlessPoseCardPhoto(options)).render();
}
