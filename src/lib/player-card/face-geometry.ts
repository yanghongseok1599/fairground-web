export type Point = { x: number; y: number };
export type Triangle = readonly [Point, Point, Point];
export type AffineTransform = readonly [number, number, number, number, number, number];

/** Map matching facial triangles, including rotation and perspective-related shape changes. */
export function triangleTransform(source: Triangle, target: Triangle): AffineTransform | null {
  const [s0, s1, s2] = source;
  const [t0, t1, t2] = target;
  const sx1 = s1.x - s0.x;
  const sy1 = s1.y - s0.y;
  const sx2 = s2.x - s0.x;
  const sy2 = s2.y - s0.y;
  const determinant = sx1 * sy2 - sx2 * sy1;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 0.0001) return null;
  const a = ((t1.x - t0.x) * sy2 - (t2.x - t0.x) * sy1) / determinant;
  const b = ((t1.y - t0.y) * sy2 - (t2.y - t0.y) * sy1) / determinant;
  const c = (sx1 * (t2.x - t0.x) - sx2 * (t1.x - t0.x)) / determinant;
  const d = (sx1 * (t2.y - t0.y) - sx2 * (t1.y - t0.y)) / determinant;
  const result = [a, b, c, d, t0.x - a * s0.x - c * s0.y, t0.y - b * s0.x - d * s0.y] as const;
  return result.every(Number.isFinite) ? result : null;
}

/** A solid interior replaces the old face; only the outer skin boundary is feathered. */
export function faceMaskAlpha(point: Point, outline: readonly Point[], feather: number): number {
  let inside = false;
  let distanceSquared = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[j];
    const b = outline[i];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    distanceSquared = Math.min(distanceSquared,
      (point.x - a.x - t * dx) ** 2 + (point.y - a.y - t * dy) ** 2);
  }
  if (!inside) return 0;
  const fraction = Math.min(1, Math.sqrt(distanceSquared) / Math.max(1, feather));
  return fraction * fraction * (3 - 2 * fraction);
}

export function requireSingleFace<T>(faces: readonly T[]): T {
  if (faces.length === 0) throw new Error("얼굴을 찾지 못했습니다. 얼굴이 크게 보이는 밝은 정면 사진을 선택해주세요.");
  if (faces.length !== 1) throw new Error("여러 얼굴이 감지되었습니다. 본인만 나온 사진을 선택해주세요.");
  return faces[0];
}
