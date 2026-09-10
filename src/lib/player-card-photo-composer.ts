import type { Gender } from "@/types";
import { getTeamlessPlayerCardPose } from "@/lib/player-card-pose-templates";
import { detectCardFace } from "@/lib/player-card/face-landmarks";
import { faceMaskAlpha, triangleTransform, type Point, type Triangle } from "@/lib/player-card/face-geometry";

interface ComposeTeamlessPosePhotoOptions {
  sourcePhoto: Blob;
  gender?: Gender | null;
  seed?: string;
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

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("선수카드용 이미지 생성에 실패했습니다.");
  return { canvas, context };
}

export async function composeTeamlessPoseCardPhoto({
  sourcePhoto, gender, seed, mimeType = "image/webp", quality = 0.92,
}: ComposeTeamlessPosePhotoOptions): Promise<Blob> {
  const template = getTeamlessPlayerCardPose(gender, seed);
  const sourceUrl = URL.createObjectURL(sourcePhoto);
  try {
    const [source, templateImage, { FaceLandmarker }] = await Promise.all([
      loadImage(sourceUrl), loadImage(template.src), import("@mediapipe/tasks-vision"),
    ]);
    const sourceLandmarks = await detectCardFace(source);
    const targetLandmarks = await detectCardFace(templateImage);
    const width = templateImage.naturalWidth;
    const height = templateImage.naturalHeight;
    const { canvas, context } = createCanvas(width, height);
    const { canvas: faceCanvas, context: faceContext } = createCanvas(width, height);
    context.drawImage(templateImage, 0, 0);

    const sourcePoints = sourceLandmarks.map((p) => ({ x: p.x * source.naturalWidth, y: p.y * source.naturalHeight }));
    const targetPoints = targetLandmarks.map((p) => ({ x: p.x * width, y: p.y * height }));
    const connections = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    for (let i = 0; i < connections.length; i += 3) {
      const indices = [connections[i].start, connections[i].end, connections[i + 1].end];
      const from = indices.map((index) => sourcePoints[index]) as unknown as Triangle;
      const to = indices.map((index) => targetPoints[index]) as unknown as Triangle;
      const transform = triangleTransform(from, to);
      if (!transform) continue;
      const center = { x: (to[0].x + to[1].x + to[2].x) / 3, y: (to[0].y + to[1].y + to[2].y) / 3 };
      faceContext.save();
      faceContext.beginPath();
      // Subpixel overlap prevents transparent seams between adjoining triangles.
      to.forEach((point, index) => {
        const length = Math.hypot(point.x - center.x, point.y - center.y) || 1;
        const x = point.x + (point.x - center.x) * 0.7 / length;
        const y = point.y + (point.y - center.y) * 0.7 / length;
        if (index === 0) faceContext.moveTo(x, y);
        else faceContext.lineTo(x, y);
      });
      faceContext.closePath();
      faceContext.clip();
      faceContext.setTransform(...transform);
      faceContext.drawImage(source, 0, 0);
      faceContext.restore();
    }

    const outline: Point[] = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.map(({ start }) => targetPoints[start]);
    const left = Math.max(0, Math.floor(Math.min(...outline.map((p) => p.x))));
    const top = Math.max(0, Math.floor(Math.min(...outline.map((p) => p.y))));
    const right = Math.min(width, Math.ceil(Math.max(...outline.map((p) => p.x))));
    const bottom = Math.min(height, Math.ceil(Math.max(...outline.map((p) => p.y))));
    const facePixels = faceContext.getImageData(left, top, right - left, bottom - top);
    const templatePixels = context.getImageData(left, top, right - left, bottom - top);
    const feather = (right - left) * 0.06;
    for (let y = 0; y < facePixels.height; y++) {
      for (let x = 0; x < facePixels.width; x++) {
        const offset = (y * facePixels.width + x) * 4;
        // Pixel alpha works on iOS Safari too (Canvas filter is not required).
        facePixels.data[offset + 3] *= faceMaskAlpha({ x: left + x + 0.5, y: top + y + 0.5 }, outline, feather)
          * templatePixels.data[offset + 3] / 255;
      }
    }
    faceContext.clearRect(0, 0, width, height);
    faceContext.putImageData(facePixels, left, top);
    context.drawImage(faceCanvas, 0, 0);

    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("선수카드용 이미지 생성에 실패했습니다."));
    }, mimeType, quality));
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
