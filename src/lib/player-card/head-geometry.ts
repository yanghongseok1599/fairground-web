export interface HeadPoint { x: number; y: number }
export type HeadTransform = [number, number, number, number, number, number];
export interface HeadAdjustment { scale: number; offsetX: number; offsetY: number }
export const DEFAULT_HEAD_ADJUSTMENT: HeadAdjustment = { scale: 1, offsetX: 0, offsetY: 0 };

// Lower face outline, left cheek → chin → right cheek (MediaPipe face mesh).
export const LOWER_JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454] as const;

function faceFrame(points: HeadPoint[]) {
  const leftEye = points[33], rightEye = points[263], forehead = points[10], chin = points[152];
  if (![leftEye, rightEye, forehead, chin, ...LOWER_JAW.map(i => points[i])]
    .every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
    throw new Error("얼굴 전체가 보이는 정면 사진을 사용해주세요.");
  }
  const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const horizontal = LOWER_JAW.map(i => points[i].x * cos + points[i].y * sin);
  const width = Math.max(...horizontal) - Math.min(...horizontal);
  const height = (chin.y - forehead.y) * cos - (chin.x - forehead.x) * sin;
  if (Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) < 1 || width < 1 || height < 1) {
    throw new Error("얼굴 전체가 보이는 정면 사진을 사용해주세요.");
  }
  return { angle, width, height };
}

/** Uniform scale/rotation preserves the person's face shape and hairstyle. */
export function alignWholeHead(source: HeadPoint[], target: HeadPoint[]): HeadTransform {
  const from = faceFrame(source), to = faceFrame(target);
  // Eye spacing varies between people; use the whole face for body proportions.
  // One uniform scale retains identity instead of stretching either axis.
  const scale = Math.sqrt((to.width / from.width) * (to.height / from.height));
  const angle = to.angle - from.angle;
  const a = scale * Math.cos(angle);
  const b = scale * Math.sin(angle);
  const chin = source[152];
  return [a, b, -b, a, target[152].x - a * chin.x + b * chin.y, target[152].y - b * chin.x - a * chin.y];
}

/** Keep the original neck up to its curved jaw, not a horizontal chin cut. */
export function uniformNeckOutline(points: HeadPoint[], width: number, height: number): HeadPoint[] {
  const jaw = LOWER_JAW.map(index => points[index]);
  const bottom = Math.max(...jaw.map(point => point.y));
  const face = faceFrame(points);
  const center = points[152].x;
  // Only retain the central neck, never side-of-jaw/ear pixels from the model.
  const left = center - face.width * 0.25, right = center + face.width * 0.25;
  const jawY = (x: number) => {
    for (let i = 1; i < jaw.length; i++) {
      const a = jaw[i - 1], b = jaw[i];
      if (x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x) && a.x !== b.x) {
        return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
      }
    }
    return bottom;
  };
  const neck = [{ x: left, y: jawY(left) }, ...jaw.filter(p => p.x > left && p.x < right), { x: right, y: jawY(right) }]
    .map(p => ({ x: p.x, y: Math.min(bottom, p.y + face.height * 0.03) }));
  return [
    { x: 0, y: bottom }, { x: left, y: bottom }, ...neck,
    { x: right, y: bottom }, { x: width, y: bottom },
    { x: width, y: height }, { x: 0, y: height },
  ];
}

export function transformHeadPoint(point: HeadPoint, matrix: HeadTransform): HeadPoint {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] };
}

/** Adjust the head around its chin; the jersey and shoulders never move. */
export function adjustHeadTransform(base: HeadTransform, target: HeadPoint[], adjustment: HeadAdjustment): HeadTransform {
  const bounded = (value: number, min: number, max: number, fallback: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const scale = bounded(adjustment.scale, 0.8, 1.25, 1);
  const face = faceFrame(target), chin = target[152];
  const dx = bounded(adjustment.offsetX, -0.15, 0.15, 0) * face.width;
  const dy = bounded(adjustment.offsetY, -0.1, 0.1, 0) * face.height;
  return [base[0] * scale, base[1] * scale, base[2] * scale, base[3] * scale,
    chin.x + (base[4] - chin.x) * scale + dx, chin.y + (base[5] - chin.y) * scale + dy];
}

export function headBounds(points: HeadPoint[]) {
  return {
    left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)), bottom: points[152].y, center: points[152].x,
  };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
/** Reject low-confidence background haze while retaining a soft contour. */
export const foregroundAlpha = (probability: number) => clamp((probability - 0.15) / 0.7);

/** Classes: background, hair, body skin, face skin, clothes, accessories. */
export function wholeHeadAlpha(probabilities: readonly number[], point: HeadPoint, bounds: ReturnType<typeof headBounds>): number {
  const faceWidth = bounds.right - bounds.left;
  const faceHeight = bounds.bottom - bounds.top;
  const neckFade = clamp((bounds.bottom + faceHeight * 0.2 - point.y) / Math.max(1, faceHeight * 0.16));
  const nearHead = point.y < bounds.bottom && Math.abs(point.x - bounds.center) < faceWidth;
  const neckWidth = clamp((faceWidth * 0.38 - Math.abs(point.x - bounds.center)) / Math.max(1, faceWidth * 0.08));
  // Long hair has no chin cutoff; only neck skin fades into the new body.
  return clamp(probabilities[1] + probabilities[3]
    + probabilities[2] * (nearHead ? 1 : neckWidth * neckFade)
    + (nearHead ? probabilities[5] : 0));
}
