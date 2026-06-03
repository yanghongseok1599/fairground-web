import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source =
  "/Users/seok/.codex/generated_images/019e49fa-736e-7b13-bd9d-d69431ccc23e/ig_00276af671e2ff44016a102be4e8b48191acc22e9c6ac56e99.png";
const outDir = path.join(process.cwd(), "public/images/player-card-tier-concepts/no-shadow-set");

const tiers = ["bronze", "silver", "gold", "premium"];
const target = { width: 1080, height: 1240 };

function isCheckerBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 222 && max - min < 22;
}

function removeConnectedBackground(data, width, height) {
  const seen = new Uint8Array(width * height);
  const queue = [];

  function push(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!isCheckerBackground(data[i], data[i + 1], data[i + 2])) return;
    seen[idx] = 1;
    queue.push(idx);
  }

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const idx = queue[cursor];
    const x = idx % width;
    const y = Math.floor(idx / width);
    data[idx * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function alphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const pad = 8;
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width - Math.max(0, minX - pad), maxX - minX + 1 + pad * 2),
    height: Math.min(height - Math.max(0, minY - pad), maxY - minY + 1 + pad * 2),
  };
}

async function extractTier(index) {
  const metadata = await sharp(source).metadata();
  const sliceWidth = Math.floor(metadata.width / 4);
  const left = index * sliceWidth;
  const width = index === 3 ? metadata.width - left : sliceWidth;

  const { data, info } = await sharp(source)
    .extract({ left, top: 0, width, height: metadata.height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = Buffer.from(data);
  removeConnectedBackground(rgba, info.width, info.height);

  const cleaned = await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const { data: cleanData, info: cleanInfo } = await sharp(cleaned)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(cleanData, cleanInfo.width, cleanInfo.height);

  const output = await sharp(cleaned)
    .extract(bounds)
    .resize(target.width, target.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const outPath = path.join(outDir, `${tiers[index]}-card-no-shadow.png`);
  await fs.writeFile(outPath, output);
  return outPath;
}

await fs.mkdir(outDir, { recursive: true });

const outputs = [];
for (let i = 0; i < tiers.length; i += 1) {
  outputs.push(await extractTier(i));
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
      outputs.map(async (outPath, index) => ({
        input: await sharp(outPath)
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

await fs.writeFile(path.join(outDir, "preview-no-shadow-set.png"), preview);

for (const outPath of outputs) {
  console.log(outPath);
}
