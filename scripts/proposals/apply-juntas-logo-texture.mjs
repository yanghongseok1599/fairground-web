import path from "node:path";
import sharp from "sharp";

const [, , basePath, outputPath, leftArg, topArg, widthArg, color = "#f2efe7", opacityArg = "0.82", rotationArg = "0"] = process.argv;

if (!basePath || !outputPath || !leftArg || !topArg || !widthArg) {
  console.error(
    "Usage: node scripts/proposals/apply-juntas-logo-texture.mjs <base> <output> <left> <top> <width> [color] [opacity] [rotation]",
  );
  process.exit(1);
}

const logoPath = path.resolve("public/proposals/juntas/juntas-logo.png");
const left = Number(leftArg);
const top = Number(topArg);
const width = Number(widthArg);
const opacity = Number(opacityArg);
const rotation = Number(rotationArg);
const normalizedColor = color.replace("#", "");
const ink = {
  r: Number.parseInt(normalizedColor.slice(0, 2), 16),
  g: Number.parseInt(normalizedColor.slice(2, 4), 16),
  b: Number.parseInt(normalizedColor.slice(4, 6), 16),
};

const resizedLogo = await sharp(logoPath)
  .resize({ width, kernel: sharp.kernel.lanczos3 })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const baseTexture = await sharp(basePath)
  .extract({
    left,
    top,
    width: resizedLogo.info.width,
    height: resizedLogo.info.height,
  })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let index = 0; index < resizedLogo.data.length; index += 4) {
  const textureIndex = (index / 4) * baseTexture.info.channels;
  const luminance =
    baseTexture.data[textureIndex] * 0.2126 +
    baseTexture.data[textureIndex + 1] * 0.7152 +
    baseTexture.data[textureIndex + 2] * 0.0722;
  const fabricShade = Math.min(1, Math.max(0.58, 0.58 + (luminance / 255) * 0.55));
  resizedLogo.data[index] = Math.round(ink.r * fabricShade);
  resizedLogo.data[index + 1] = Math.round(ink.g * fabricShade);
  resizedLogo.data[index + 2] = Math.round(ink.b * fabricShade);
  resizedLogo.data[index + 3] = Math.round(
    resizedLogo.data[index + 3] * opacity * (0.72 + (luminance / 255) * 0.28),
  );
}

const logo = await sharp(resizedLogo.data, { raw: resizedLogo.info })
  .blur(0.32)
  .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp(basePath)
  .composite([
    {
      input: logo,
      left,
      top,
      blend: "over",
    },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);
