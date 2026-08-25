"use client";

import { useEffect, useState } from "react";

const MAX_LOGO_PROCESS_SIZE = 256;
const MIN_OPAQUE_ALPHA = 24;
const BG_TOLERANCE = 44;
const BG_TOLERANCE_SQ = BG_TOLERANCE * BG_TOLERANCE;

type Rgb = { r: number; g: number; b: number };

function colorDistanceSq(a: Rgb, r: number, g: number, b: number) {
  const dr = a.r - r;
  const dg = a.g - g;
  const db = a.b - b;
  return dr * dr + dg * dg + db * db;
}

function getCornerBackgroundColor(data: Uint8ClampedArray, width: number, height: number): Rgb | null {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const samples = corners
    .map((pixel) => pixel * 4)
    .filter((idx) => data[idx + 3] >= MIN_OPAQUE_ALPHA)
    .map((idx) => ({ r: data[idx], g: data[idx + 1], b: data[idx + 2] }));

  if (samples.length === 0) return null;

  return {
    r: Math.round(samples.reduce((sum, sample) => sum + sample.r, 0) / samples.length),
    g: Math.round(samples.reduce((sum, sample) => sum + sample.g, 0) / samples.length),
    b: Math.round(samples.reduce((sum, sample) => sum + sample.b, 0) / samples.length),
  };
}

function shouldRemovePixel(data: Uint8ClampedArray, idx: number, background: Rgb) {
  const alpha = data[idx + 3];
  if (alpha < MIN_OPAQUE_ALPHA) return true;
  return colorDistanceSq(background, data[idx], data[idx + 1], data[idx + 2]) <= BG_TOLERANCE_SQ;
}

function removeConnectedBackground(image: HTMLImageElement) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(1, MAX_LOGO_PROCESS_SIZE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const background = getCornerBackgroundColor(data, width, height);
  if (!background) return null;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const enqueue = (pixel: number) => {
    if (pixel < 0 || pixel >= visited.length || visited[pixel]) return;
    const idx = pixel * 4;
    if (!shouldRemovePixel(data, idx, background)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  let removed = 0;
  while (queue.length > 0) {
    const pixel = queue.pop() ?? 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const idx = pixel * 4;
    data[idx + 3] = 0;
    removed += 1;

    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }

  const area = width * height;
  if (removed < area * 0.01 || removed > area * 0.9) return null;

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function useTeamLogoBackgroundRemoval(src?: string) {
  const [processed, setProcessed] = useState<{ source?: string; value?: string }>({
    source: src,
    value: src,
  });

  useEffect(() => {
    let cancelled = false;
    if (!src || typeof window === "undefined") return;

    const image = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.decoding = "async";
    image.onload = () => {
      try {
        const result = removeConnectedBackground(image);
        if (!cancelled) setProcessed({ source: src, value: result ?? src });
      } catch {
        if (!cancelled) setProcessed({ source: src, value: src });
      }
    };
    image.onerror = () => {
      if (!cancelled) setProcessed({ source: src, value: src });
    };
    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return processed.source === src ? processed.value : src;
}
