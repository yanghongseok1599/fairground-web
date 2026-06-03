import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "public/사용자 첨부 파일.png");
const outDir = path.join(process.cwd(), "public/images/team-logos");

const crops = [
  { file: "ref-nova", left: 56, top: 55, width: 390, height: 370 },
  { file: "ref-rift", left: 480, top: 55, width: 372, height: 370 },
  { file: "ref-volt", left: 890, top: 45, width: 332, height: 380 },
  { file: "ref-afc", left: 1285, top: 55, width: 292, height: 370 },
  { file: "ref-bulls", left: 270, top: 500, width: 384, height: 350 },
  { file: "ref-blue7", left: 708, top: 498, width: 280, height: 350 },
  { file: "ref-orion", left: 1070, top: 505, width: 360, height: 345 },
];

function transparentFloodFill({ data, width, height, threshold = 36 }) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const off = idx * 4;
    const r = data[off];
    const g = data[off + 1];
    const b = data[off + 2];
    if (r > threshold || g > threshold || b > threshold) return;
    visited[idx] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i];
    const off = (y * width + x) * 4;
    data[off + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return data;
}

await fs.mkdir(outDir, { recursive: true });

for (const crop of crops) {
  const extracted = sharp(source)
    .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
    .ensureAlpha();

  const { data, info } = await extracted.raw().toBuffer({ resolveWithObject: true });
  const transparent = transparentFloodFill({ data: Buffer.from(data), width: info.width, height: info.height });
  const png = await sharp(transparent, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await fs.writeFile(path.join(outDir, `${crop.file}.png`), png);
}

console.log(`Cropped ${crops.length} reference logos into ${outDir}`);
