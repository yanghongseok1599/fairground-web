import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const files = [
  "public/images/bronze-card.png",
  "public/images/silver-card.png",
  "public/images/gold-card-ducktape.png",
  "public/images/premium-card-matched.png",
];

const backupDir = path.join(root, "public/images/player-card-tier-concepts/stat-panel-backups");
const previewDir = path.join(root, "public/images/player-card-tier-concepts");

const panelPalettes = {
  "bronze-card.png": {
    top: [248, 178, 150],
    mid: [232, 132, 96],
    bottom: [214, 100, 72],
    shine: [255, 226, 211],
  },
  "silver-card.png": {
    top: [246, 250, 254],
    mid: [224, 234, 244],
    bottom: [196, 210, 224],
    shine: [255, 255, 255],
  },
  "gold-card-ducktape.png": {
    top: [255, 232, 150],
    mid: [238, 199, 82],
    bottom: [209, 163, 58],
    shine: [255, 248, 205],
  },
  "premium-card-matched.png": {
    top: [255, 236, 150],
    mid: [238, 200, 82],
    bottom: [210, 166, 62],
    shine: [255, 250, 205],
  },
};

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function regionMask(x, y, width, height) {
  const nx = x / width;
  const ny = y / height;

  const leftEdge = 0.215 + Math.max(0, ny - 0.66) * 0.11;
  const rightEdge = 1 - leftEdge;
  const left = smoothstep(leftEdge, leftEdge + 0.045, nx);
  const right = 1 - smoothstep(rightEdge - 0.045, rightEdge, nx);
  const top = smoothstep(0.538, 0.575, ny);
  const bottom = 1 - smoothstep(0.795, 0.875, ny);

  return Math.max(0, Math.min(1, left * right * top * bottom));
}

function panelColor(x, y, width, height, palette) {
  const nx = x / width;
  const ny = y / height;
  const t = Math.max(0, Math.min(1, (ny - 0.54) / 0.32));
  const lower = t < 0.56
    ? palette.top.map((v, i) => mix(v, palette.mid[i], t / 0.56))
    : palette.mid.map((v, i) => mix(v, palette.bottom[i], (t - 0.56) / 0.44));

  const diagonalHighlight = 1 - smoothstep(0.02, 0.22, Math.abs(ny - (0.58 + (nx - 0.3) * 0.32)));
  const broadLight = 0.18 * (1 - smoothstep(0.58, 0.88, ny));
  const brush = (Math.sin((x * 0.12) + (y * 0.02)) + Math.sin((x * 0.027) - (y * 0.04))) * 0.45;

  return lower.map((v, i) => {
    const brightened = mix(v, palette.shine[i], diagonalHighlight * 0.18 + broadLight);
    return clamp(brightened + brush);
  });
}

async function processFile(relativePath) {
  const file = path.join(root, relativePath);
  const backup = path.join(backupDir, path.basename(relativePath));

  try {
    await fs.access(backup);
  } catch {
    await fs.copyFile(file, backup);
  }

  const inputFile = await fs.access(backup).then(() => backup).catch(() => file);
  const palette = panelPalettes[path.basename(relativePath)];
  const { data, info } = await sharp(inputFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let i = 0; i < output.length; i += 4) {
    const alpha = output[i + 3];
    if (alpha === 0) continue;

    const pixel = i / 4;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    const mask = regionMask(x, y, info.width, info.height);
    if (mask <= 0) continue;

    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    const [targetR, targetG, targetB] = panelColor(x, y, info.width, info.height, palette);
    const strength = mask * 0.64;

    output[i] = clamp(mix(r, targetR, strength));
    output[i + 1] = clamp(mix(g, targetG, strength));
    output[i + 2] = clamp(mix(b, targetB, strength));
  }

  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(file);
}

await fs.mkdir(backupDir, { recursive: true });

for (const file of files) {
  await processFile(file);
}

const preview = await sharp({
  create: {
    width: 1800,
    height: 760,
    channels: 4,
    background: { r: 7, g: 11, b: 17, alpha: 1 },
  },
})
  .composite(
    await Promise.all(
      files.map(async (file, index) => ({
        input: await sharp(path.join(root, file))
          .resize(360, 413, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        left: 70 + index * 430,
        top: 120,
      })),
    ),
  )
  .png()
  .toBuffer();

await fs.writeFile(path.join(previewDir, "stat-panel-softened-preview.png"), preview);

console.log("Softened stat panel shadow in existing card PNGs");
