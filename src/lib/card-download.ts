const TARGET_EXPORT_PX = 2400;
const MIN_EXPORT_SCALE = 3;
const MAX_EXPORT_SCALE = 8;
const NATIVE_SHARE_HANDOFF_TIMEOUT_MS = 1500;

export type PngDeliveryResult = "shared" | "downloaded" | "native-save";

function getExportScale(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const width = Math.max(rect.width, element.offsetWidth, 1);
  const height = Math.max(rect.height, element.offsetHeight, 1);
  const longestSide = Math.max(width, height);
  const targetScale = TARGET_EXPORT_PX / longestSide;

  return Math.min(MAX_EXPORT_SCALE, Math.max(MIN_EXPORT_SCALE, targetScale));
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      try {
        await image.decode();
      } catch {
        // html2canvas can still attempt to render cached/CORS-enabled images.
      }
    })
  );

  const html2canvas = (await import("html2canvas")).default;
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(Math.max(rect.width, element.offsetWidth, 1));
  const height = Math.ceil(Math.max(rect.height, element.offsetHeight, 1));
  return html2canvas(element, {
    backgroundColor: null,
    scale: getExportScale(element),
    width,
    height,
    useCORS: true,
    allowTaint: false,
    imageTimeout: 20000,
    logging: false,
  });
}

export async function elementToPngBlob(element: HTMLElement): Promise<Blob> {
  const canvas = await renderElementToCanvas(element);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }
      reject(new Error("카드 이미지를 생성하지 못했습니다."));
    }, "image/png");
  });

  return blob;
}

export function isAppleMobileDevice(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): boolean {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

function createPngFile(blob: Blob, filename: string) {
  return new File([blob], filename, {
    type: "image/png",
    lastModified: Date.now(),
  });
}

function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

async function openNativeShare(shareData: ShareData): Promise<void> {
  const sharePromise = navigator.share(shareData);

  // Some WebKit versions do not settle navigator.share() after "Save Image".
  // The native sheet has already received the file, so do not leave the UI
  // permanently stuck in a loading state while waiting for that promise.
  await Promise.race([
    sharePromise,
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, NATIVE_SHARE_HANDOFF_TIMEOUT_MS);
    }),
  ]);
}

function downloadPngBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoking immediately can cancel blob downloads in iOS WebKit.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function savePngBlob(
  blob: Blob,
  filename: string,
): Promise<PngDeliveryResult> {
  const file = createPngFile(blob, filename);

  if (isAppleMobileDevice() && canShareFile(file)) {
    try {
      await openNativeShare({ files: [file] });
      return "native-save";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      downloadPngBlob(blob, filename);
      return "downloaded";
    }
  }

  downloadPngBlob(blob, filename);
  return "downloaded";
}

export async function sharePngBlob(
  blob: Blob,
  filename: string,
  shareData: Pick<ShareData, "title" | "text" | "url"> = {},
): Promise<PngDeliveryResult> {
  const file = createPngFile(blob, filename);

  if (canShareFile(file)) {
    try {
      await openNativeShare({
        ...shareData,
        files: [file],
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
    }
  }

  downloadPngBlob(blob, filename);
  return "downloaded";
}
