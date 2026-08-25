const TARGET_EXPORT_PX = 2400;
const MIN_EXPORT_SCALE = 3;
const MAX_EXPORT_SCALE = 8;

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

function downloadPngBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadElementAsPng(element: HTMLElement, filename: string) {
  const blob = await elementToPngBlob(element);
  downloadPngBlob(blob, filename);
}

export async function shareElementAsPng(
  element: HTMLElement,
  filename: string,
  shareData: { title?: string; text?: string } = {}
): Promise<"shared" | "downloaded"> {
  const blob = await elementToPngBlob(element);
  const file = new File([blob], filename, { type: "image/png" });
  const canShareFile =
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (typeof navigator.share === "function" && canShareFile) {
    await navigator.share({
      ...shareData,
      files: [file],
    });
    return "shared";
  }

  downloadPngBlob(blob, filename);
  return "downloaded";
}
