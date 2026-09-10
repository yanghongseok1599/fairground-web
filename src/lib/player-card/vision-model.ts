/** Same-origin, pinned models; AbortController also works on older Safari. */
export async function loadVisionModel(path: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) throw new Error("이미지 인식 모델을 불러오지 못했습니다. 다시 시도해주세요.");
    return new Uint8Array(await response.arrayBuffer());
  } finally { clearTimeout(timer); }
}
