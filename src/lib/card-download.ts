export async function downloadElementAsPng(element: HTMLElement, filename: string) {
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
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
