import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source =
  "/Users/seok/.codex/generated_images/019e49fa-736e-7b13-bd9d-d69431ccc23e/ig_00276af671e2ff44016a1013d607948191971438564b058200.png";
const outDir = path.join(process.cwd(), "public/images");
const previewDir = path.join(process.cwd(), "public/images/player-card-tier-concepts");

const targetSize = { width: 1080, height: 1240 };
const cards = [
  { name: "bronze", left: 0, top: 0, width: 768, height: 1024 },
  { name: "silver", left: 768, top: 0, width: 768, height: 1024 },
];

function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max > 226 && max - min < 18;
}

function removeConnectedBackground(data, width, height) {
  const queue = [];
  const seen = new Uint8Array(width * height);

  function push(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (seen[idx]) return;
    const i = idx * 4;
    if (!isBackground(data[i], data[i + 1], data[i + 2])) return;
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
    const i = idx * 4;
    data[i + 3] = 0;
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
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0) return { left: 0, top: 0, width, height };
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function extract(card) {
  const { data, info } = await sharp(source)
    .extract(card)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = Buffer.from(data);
  removeConnectedBackground(rgba, info.width, info.height);

  const cleaned = sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
  const png = await cleaned.png().toBuffer();
  const { data: cleanData, info: cleanInfo } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(cleanData, cleanInfo.width, cleanInfo.height);

  const fitted = await sharp(png)
    .extract(bounds)
    .resize(targetSize.width, targetSize.height, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const out = path.join(outDir, `${card.name}-card.png`);
  const concept = path.join(previewDir, `${card.name}-generated-clean-border.png`);
  await fs.writeFile(out, fitted);
  await fs.writeFile(concept, fitted);
}

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

for (const card of cards) {
  await extract(card);
}

const contact = await sharp({
  create: {
    width: 1100,
    height: 700,
    channels: 4,
    background: { r: 7, g: 11, b: 17, alpha: 1 },
  },
})
  .composite(
    await Promise.all(
      cards.map(async (card, index) => ({
        input: await sharp(path.join(outDir, `${card.name}-card.png`))
          .resize(420, 482, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        left: 90 + index * 510,
        top: 78,
      })),
    ),
  )
  .png()
  .toBuffer();

await fs.writeFile(path.join(previewDir, "generated-clean-border-contact.png"), contact);

console.log("Extracted generated bronze/silver cards as transparent 1080x1240 PNGs");
