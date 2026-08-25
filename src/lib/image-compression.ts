export type ImageCompressionOptions = {
  maxPx?: number;
  mimeType?: "image/jpeg" | "image/webp";
  quality?: number;
};

const BACKGROUND_REMOVAL_PUBLIC_PATH =
  "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

export const compressImageBlob = (
  input: Blob,
  {
    maxPx = 720,
    mimeType = "image/webp",
    quality = 0.72,
  }: ImageCompressionOptions = {}
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    if (input instanceof File && !input.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 업로드할 수 있습니다."));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(input);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = image;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("이미지 처리에 실패했습니다."));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 압축에 실패했습니다."));
            return;
          }
          resolve(blob);
        },
        mimeType,
        quality
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    image.src = objectUrl;
  });

export const removeBackgroundAndCompress = async (
  input: Blob,
  options: ImageCompressionOptions = {
    maxPx: 1400,
    mimeType: "image/webp",
    quality: 0.92,
  },
): Promise<Blob> => {
  const { removeBackground } = await import("@imgly/background-removal");
  const bgRemoved = await removeBackground(input, {
    publicPath: BACKGROUND_REMOVAL_PUBLIC_PATH,
    debug: false,
  });

  return compressImageBlob(bgRemoved, options);
};
