import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "public/images/gold-card-ducktape.png");
const outDir = path.join(process.cwd(), "public/images");

const palettes = {
  bronze: {
    shadow: [92, 39, 28],
    mid: [188, 92, 68],
    light: [248, 163, 128],
    shine: [255, 222, 205],
  },
  silver: {
    shadow: [72, 84, 96],
    mid: [162, 174, 186],
    light: [232, 239, 247],
    shine: [255, 255, 255],
  },
};

function mix(a, b, t) {
  return a + (b - a) * t;
}

function grade(luma, palette) {
  if (luma < 0.34) {
    const t = luma / 0.34;
    return palette.shadow.map((v, i) => mix(v, palette.mid[i], t));
  }
  if (luma < 0.78) {
    const t = (luma - 0.34) / 0.44;
    return palette.mid.map((v, i) => mix(v, palette.light[i], t));
  }
  const t = (luma - 0.78) / 0.22;
  return palette.light.map((v, i) => mix(v, palette.shine[i], t));
}

function softenStatsShadow(y, height, r, g, b) {
  const top = height * 0.62;
  const bottom = height * 0.84;
  if (y < top || y > bottom) return [r, g, b];

  const lift = 0.08;
  return [
    mix(r, 255, lift),
    mix(g, 255, lift),
    mix(b, 255, lift),
  ];
}

async function makeTier(name, palette) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let i = 0; i < output.length; i += 4) {
    const alpha = output[i + 3];
    if (alpha === 0) continue;

    const pixel = i / 4;
    const y = Math.floor(pixel / info.width);
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    const luma = Math.max(0, Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255));
    let [nr, ng, nb] = grade(luma, palette);
    [nr, ng, nb] = softenStatsShadow(y, info.height, nr, ng, nb);

    output[i] = Math.round(nr);
    output[i + 1] = Math.round(ng);
    output[i + 2] = Math.round(nb);
    output[i + 3] = alpha;
  }

  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toFile(path.join(outDir, `${name}-card.png`));
}

await fs.mkdir(outDir, { recursive: true });
await makeTier("bronze", palettes.bronze);
await makeTier("silver", palettes.silver);

console.log("Generated bronze-card.png and silver-card.png from the existing gold-card-ducktape.png template");
