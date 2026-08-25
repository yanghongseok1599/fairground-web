import type { Gender } from "@/types";
import {
  type PlayerCardPoseTemplate,
  getTeamlessPlayerCardPose,
} from "@/lib/player-card-pose-templates";

type FaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FaceDetectionResult = {
  boundingBox: FaceBounds | DOMRectReadOnly;
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect(source: ImageBitmap): Promise<FaceDetectionResult[]>;
};

declare global {
  interface Window {
    FaceDetector?: FaceDetectorConstructor;
  }
}

interface ComposeTeamlessPosePhotoOptions {
  sourcePhoto: Blob;
  cutoutPhoto: Blob;
  gender?: Gender | null;
  seed?: string;
  mimeType?: "image/webp" | "image/png";
  quality?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    image.src = url;
  });
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("포즈 템플릿을 불러오지 못했습니다."));
    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/png",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("선수카드용 포즈 이미지 생성에 실패했습니다."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

function fallbackFaceBounds(image: HTMLImageElement): FaceBounds {
  const portraitBias = image.height >= image.width;
  const width = image.width * (portraitBias ? 0.62 : 0.54);
  const height = image.height * (portraitBias ? 0.54 : 0.62);
  return {
    x: (image.width - width) / 2,
    y: image.height * 0.04,
    width,
    height,
  };
}

async function detectFaceBounds(blob: Blob, image: HTMLImageElement): Promise<FaceBounds> {
  if (typeof window === "undefined" || !window.FaceDetector || !("createImageBitmap" in window)) {
    return fallbackFaceBounds(image);
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(bitmap);
    const face = faces[0]?.boundingBox;
    if (!face) return fallbackFaceBounds(image);

    const raw = {
      x: face.x,
      y: face.y,
      width: face.width,
      height: face.height,
    };

    const expandedWidth = raw.width * 1.9;
    const expandedHeight = raw.height * 2.35;
    return {
      x: clamp(raw.x - raw.width * 0.45, 0, image.width),
      y: clamp(raw.y - raw.height * 0.78, 0, image.height),
      width: clamp(expandedWidth, 1, image.width),
      height: clamp(expandedHeight, 1, image.height),
    };
  } catch {
    return fallbackFaceBounds(image);
  } finally {
    bitmap?.close();
  }
}

function fitCropToTarget(crop: FaceBounds, target: FaceBounds): FaceBounds {
  let { x, y, width, height } = crop;
  const cropAspect = width / height;
  const targetAspect = target.width / target.height;

  if (cropAspect > targetAspect) {
    const nextWidth = height * targetAspect;
    x += (width - nextWidth) / 2;
    width = nextWidth;
  } else {
    const nextHeight = width / targetAspect;
    y += (height - nextHeight) / 2;
    height = nextHeight;
  }

  return { x, y, width, height };
}

function clampCropToImage(crop: FaceBounds, image: HTMLImageElement): FaceBounds {
  const width = clamp(crop.width, 1, image.width);
  const height = clamp(crop.height, 1, image.height);
  return {
    x: clamp(crop.x, 0, image.width - width),
    y: clamp(crop.y, 0, image.height - height),
    width,
    height,
  };
}

function toTemplateTarget(template: PlayerCardPoseTemplate, image: HTMLImageElement): FaceBounds {
  return {
    x: (template.faceTarget.x / 100) * image.width,
    y: (template.faceTarget.y / 100) * image.height,
    width: (template.faceTarget.width / 100) * image.width,
    height: (template.faceTarget.height / 100) * image.height,
  };
}

export async function composeTeamlessPoseCardPhoto({
  sourcePhoto,
  cutoutPhoto,
  gender,
  seed,
  mimeType = "image/webp",
  quality = 0.92,
}: ComposeTeamlessPosePhotoOptions): Promise<Blob> {
  const template = getTeamlessPlayerCardPose(gender, seed);
  const [templateImage, sourceImage, cutoutImage] = await Promise.all([
    loadImageFromSrc(template.src),
    loadImageFromBlob(sourcePhoto),
    loadImageFromBlob(cutoutPhoto),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = templateImage.naturalWidth || templateImage.width;
  canvas.height = templateImage.naturalHeight || templateImage.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("선수카드용 포즈 이미지 생성에 실패했습니다.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

  const detected = await detectFaceBounds(sourcePhoto, sourceImage);
  const sourceToCutout = {
    x: (detected.x / sourceImage.width) * cutoutImage.width,
    y: (detected.y / sourceImage.height) * cutoutImage.height,
    width: (detected.width / sourceImage.width) * cutoutImage.width,
    height: (detected.height / sourceImage.height) * cutoutImage.height,
  };
  const target = toTemplateTarget(template, templateImage);
  const crop = clampCropToImage(fitCropToTarget(sourceToCutout, target), cutoutImage);

  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.18)";
  context.shadowBlur = Math.max(canvas.width, canvas.height) * 0.006;
  context.drawImage(
    cutoutImage,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    target.x,
    target.y,
    target.width,
    target.height,
  );
  context.restore();

  return canvasToBlob(canvas, mimeType, quality);
}
