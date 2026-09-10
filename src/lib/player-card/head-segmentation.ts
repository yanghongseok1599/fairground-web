import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { loadVisionModel } from "./vision-model";
import { foregroundAlpha, headBounds, wholeHeadAlpha, type HeadPoint } from "./head-geometry";

let segmenterPromise: Promise<ImageSegmenter> | undefined;

async function getHeadSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const [vision, model] = await Promise.all([
        FilesetResolver.forVisionTasks("/vendor/mediapipe/0.10.32"),
        loadVisionModel("/models/selfie-head/selfie_multiclass_256x256.tflite"),
      ]);
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: model, delegate: "CPU" },
        runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false,
      });
    })().catch((error) => { segmenterPromise = undefined; throw error; });
  }
  return segmenterPromise;
}

/** Generated templates can contain a painted backdrop: never trust their alpha channel. */
export async function createUniformBodyCutout(image: HTMLImageElement) {
  const segmenter = await getHeadSegmenter();
  const result = segmenter.segment(image);
  try {
    const background = result.confidenceMasks?.[0];
    if (!background) throw new Error("유니폼 배경을 처리하지 못했습니다. 다시 시도해주세요.");
    const mask = document.createElement("canvas");
    mask.width = background.width; mask.height = background.height;
    const maskContext = mask.getContext("2d");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context || !maskContext) throw new Error("유니폼 배경을 처리하지 못했습니다.");
    const pixels = maskContext.createImageData(mask.width, mask.height);
    const probabilities = background.getAsFloat32Array();
    for (let i = 0; i < probabilities.length; i++) pixels.data[i * 4 + 3] = Math.round(255 * foregroundAlpha(1 - probabilities[i]));
    maskContext.putImageData(pixels, 0, 0);
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { result.close(); }
}

/** Head-focused crop improves hair resolution; processing stays on the device. */
export async function createWholeHeadCutout(image: HTMLImageElement, points: HeadPoint[]) {
  const bounds = headBounds(points);
  const faceWidth = bounds.right - bounds.left;
  const faceHeight = bounds.bottom - bounds.top;
  const left = Math.max(0, Math.floor(bounds.center - faceWidth * 1.8));
  const top = Math.max(0, Math.floor(bounds.top - faceHeight * 1.3));
  const width = Math.min(image.naturalWidth - left, Math.ceil(faceWidth * 3.6));
  const height = Math.min(image.naturalHeight - top, Math.ceil(bounds.bottom + faceHeight * 2 - top));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("머리 영역을 처리하지 못했습니다.");
  context.drawImage(image, left, top, width, height, 0, 0, width, height);
  const segmenter = await getHeadSegmenter();
  const result = segmenter.segment(canvas);
  try {
    const masks = result.confidenceMasks;
    if (!masks || masks.length !== 6) throw new Error("머리 영역을 찾지 못했습니다. 정면 사진으로 다시 시도해주세요.");
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = masks[0].width; maskCanvas.height = masks[0].height;
    const maskContext = maskCanvas.getContext("2d");
    if (!maskContext) throw new Error("머리 영역을 처리하지 못했습니다.");
    const pixels = maskContext.createImageData(maskCanvas.width, maskCanvas.height);
    const probabilities = masks.map((mask) => mask.getAsFloat32Array());
    for (let y = 0; y < maskCanvas.height; y++) {
      for (let x = 0; x < maskCanvas.width; x++) {
        const index = y * maskCanvas.width + x;
        const point = { x: left + (x + 0.5) * width / maskCanvas.width, y: top + (y + 0.5) * height / maskCanvas.height };
        pixels.data[index * 4 + 3] = Math.round(255 * foregroundAlpha(wholeHeadAlpha(probabilities.map((p) => p[index]), point, bounds)));
      }
    }
    maskContext.putImageData(pixels, 0, 0);
    context.globalCompositeOperation = "destination-in";
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(maskCanvas, 0, 0, width, height);
    return { canvas, left, top };
  } finally { result.close(); }
}
