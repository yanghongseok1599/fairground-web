export interface HeadPoint { x: number; y: number }
export type HeadTransform = [number, number, number, number, number, number];

/** Uniform scale/rotation preserves the person's face shape and hairstyle. */
export function alignWholeHead(source: HeadPoint[], target: HeadPoint[]): HeadTransform {
  const eyeVector = (points: HeadPoint[]) => ({ x: points[263].x - points[33].x, y: points[263].y - points[33].y });
  const from = eyeVector(source);
  const to = eyeVector(target);
  const fromLength = Math.hypot(from.x, from.y);
  const toLength = Math.hypot(to.x, to.y);
  if (fromLength < 1 || toLength < 1) throw new Error("정면 얼굴 사진을 사용해주세요.");
  const scale = toLength / fromLength;
  const angle = Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x);
  const a = scale * Math.cos(angle);
  const b = scale * Math.sin(angle);
  const chin = source[152];
  return [a, b, -b, a, target[152].x - a * chin.x + b * chin.y, target[152].y - b * chin.x - a * chin.y];
}

export function transformHeadPoint(point: HeadPoint, matrix: HeadTransform): HeadPoint {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4], y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] };
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
