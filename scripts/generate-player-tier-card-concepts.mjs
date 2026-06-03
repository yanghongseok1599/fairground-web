import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "public/images/gold-card-ducktape.png");
const outDir = path.join(process.cwd(), "public/images/player-card-tier-concepts");

const concepts = [
  {
    file: "bronze-01-warm-medal.png",
    palette: {
      shadow: [54, 25, 12],
      mid: [153, 73, 32],
      light: [239, 154, 83],
      shine: [255, 218, 164],
    },
    contrast: 1.05,
    satin: [100, 48, 22, 0.12],
  },
  {
    file: "bronze-02-dark-copper.png",
    palette: {
      shadow: [32, 17, 12],
      mid: [113, 53, 28],
      light: [205, 114, 59],
      shine: [255, 190, 125],
    },
    contrast: 1.18,
    satin: [40, 18, 11, 0.2],
  },
  {
    file: "bronze-03-rose-copper.png",
    palette: {
      shadow: [63, 24, 22],
      mid: [166, 78, 62],
      light: [246, 157, 119],
      shine: [255, 218, 195],
    },
    contrast: 1.08,
    satin: [128, 42, 32, 0.1],
  },
  {
    file: "silver-01-clean-platinum.png",
    palette: {
      shadow: [44, 53, 64],
      mid: [142, 154, 168],
      light: [231, 237, 245],
      shine: [255, 255, 255],
    },
    contrast: 1.08,
    satin: [142, 176, 215, 0.08],
  },
  {
    file: "silver-02-blue-ice.png",
    palette: {
      shadow: [28, 47, 69],
      mid: [118, 152, 184],
      light: [219, 239, 255],
      shine: [255, 255, 255],
    },
    contrast: 1.12,
    satin: [55, 130, 210, 0.12],
  },
  {
    file: "silver-03-gunmetal.png",
    palette: {
      shadow: [22, 27, 34],
      mid: [91, 103, 117],
      light: [194, 204, 216],
      shine: [247, 252, 255],
    },
    contrast: 1.22,
    satin: [20, 26, 34, 0.18],
  },
];

function mix(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function grade(luma, palette) {
  if (luma < 0.36) {
    const t = luma / 0.36;
    return palette.shadow.map((v, i) => mix(v, palette.mid[i], t));
  }
  if (luma < 0.78) {
    const t = (luma - 0.36) / 0.42;
    return palette.mid.map((v, i) => mix(v, palette.light[i], t));
  }
  const t = (luma - 0.78) / 0.22;
  return palette.light.map((v, i) => mix(v, palette.shine[i], t));
}

async function makeConcept({ file, palette, contrast, satin }) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let i = 0; i < output.length; i += 4) {
    const alpha = output[i + 3];
    if (alpha === 0) continue;

    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    let luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    luma = clamp01((luma - 0.5) * contrast + 0.5);
    const [nr, ng, nb] = grade(luma, palette);
    const satinAmount = satin[3];

    output[i] = Math.round(mix(nr, satin[0], satinAmount));
    output[i + 1] = Math.round(mix(ng, satin[1], satinAmount));
    output[i + 2] = Math.round(mix(nb, satin[2], satinAmount));
    output[i + 3] = alpha;
  }

  await sharp(output, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toFile(path.join(outDir, file));
}

await fs.mkdir(outDir, { recursive: true });
await Promise.all(concepts.map(makeConcept));

const contact = await sharp({
  create: {
    width: 1500,
    height: 1840,
    channels: 4,
    background: { r: 8, g: 12, b: 18, alpha: 1 },
  },
})
  .composite(
    await Promise.all(
      concepts.map(async (concept, index) => {
        const img = await sharp(path.join(outDir, concept.file))
          .resize(420, 482, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        return {
          input: img,
          left: 70 + (index % 3) * 480,
          top: 70 + Math.floor(index / 3) * 860,
        };
      }),
    ),
  )
  .png()
  .toBuffer();

await fs.writeFile(path.join(outDir, "tier-concepts-contact.png"), contact);

console.log(`Generated ${concepts.length} card concepts in ${outDir}`);
