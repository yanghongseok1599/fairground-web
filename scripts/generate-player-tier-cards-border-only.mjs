import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const conceptsDir = path.join(root, "public/images/player-card-tier-concepts");
const outDir = path.join(root, "public/images");

const cards = [
  {
    source: path.join(conceptsDir, "bronze-03-rose-copper.png"),
    target: path.join(outDir, "bronze-card.png"),
    preview: path.join(conceptsDir, "bronze-border-only.png"),
    edge: {
      dark: "#6e2f25",
      mid: "#c46850",
      light: "#ffd3c1",
      shadow: "rgba(80, 28, 18, 0.38)",
      glow: "rgba(255, 134, 102, 0.26)",
    },
  },
  {
    source: path.join(conceptsDir, "silver-01-clean-platinum.png"),
    target: path.join(outDir, "silver-card.png"),
    preview: path.join(conceptsDir, "silver-border-only.png"),
    edge: {
      dark: "#5a6876",
      mid: "#b6c2ce",
      light: "#fbfdff",
      shadow: "rgba(35, 48, 62, 0.34)",
      glow: "rgba(218, 236, 255, 0.28)",
    },
  },
];

function innerMaskSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1240">
  <path d="M268 220 C268 186 296 158 330 158 L428 158 C464 158 512 118 540 92 C568 118 616 158 652 158 L750 158 C784 158 812 186 812 220 L812 535 L846 548 L822 782 C812 875 742 982 540 1090 C338 982 268 875 258 782 L234 548 L268 535 Z" fill="#fff"/>
</svg>`);
}

function borderSvg(edge) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1240">
  <defs>
    <linearGradient id="edge" x1="176" y1="88" x2="908" y2="1148" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${edge.light}"/>
      <stop offset="0.2" stop-color="${edge.mid}"/>
      <stop offset="0.48" stop-color="${edge.dark}"/>
      <stop offset="0.72" stop-color="${edge.light}"/>
      <stop offset="1" stop-color="${edge.dark}"/>
    </linearGradient>
    <linearGradient id="rim" x1="170" y1="90" x2="900" y2="1130" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${edge.light}"/>
      <stop offset="0.52" stop-color="${edge.mid}"/>
      <stop offset="1" stop-color="${edge.dark}"/>
    </linearGradient>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="14" stdDeviation="11" flood-color="#000" flood-opacity="0.25"/>
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${edge.glow}" flood-opacity="1"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M540 66 C506 102 458 98 422 76 C390 122 318 126 262 172 C198 225 172 322 160 428 L130 536 L148 782 C160 930 266 1064 540 1190 C814 1064 920 930 932 782 L950 536 L920 428 C908 322 882 225 818 172 C762 126 690 122 658 76 C622 98 574 102 540 66 Z" fill="url(#edge)"/>
    <path d="M540 106 C510 136 466 132 438 114 C408 153 342 158 302 192 C248 238 224 326 214 432 L188 540 L204 762 C214 876 302 990 540 1120 C778 990 866 876 876 762 L892 540 L866 432 C856 326 832 238 778 192 C738 158 672 153 642 114 C614 132 570 136 540 106 Z" fill="none" stroke="${edge.light}" stroke-width="13" opacity="0.84"/>
    <path d="M540 132 C512 158 472 154 448 140 C420 174 358 180 326 208 C280 248 258 334 250 442 L226 548 L240 748 C250 842 330 946 540 1064 C750 946 830 842 840 748 L854 548 L830 442 C822 334 800 248 754 208 C722 180 660 174 632 140 C608 154 568 158 540 132 Z" fill="none" stroke="${edge.shadow}" stroke-width="9" opacity="0.5"/>
    <path d="M170 532 L226 548 M910 532 L854 548" stroke="${edge.light}" stroke-width="14" stroke-linecap="round" opacity="0.55"/>
    <path d="M540 80 C576 114 620 146 662 160 C620 164 580 148 540 112 C500 148 460 164 418 160 C460 146 504 114 540 80 Z" fill="url(#rim)" opacity="0.72"/>
    <path d="M294 186 C344 154 394 172 434 154 M786 186 C736 154 686 172 646 154" fill="none" stroke="${edge.light}" stroke-width="10" stroke-linecap="round" opacity="0.38"/>
    <path d="M234 814 C278 918 378 1010 540 1100 C702 1010 802 918 846 814" fill="none" stroke="${edge.light}" stroke-width="7" stroke-linecap="round" opacity="0.36"/>
  </g>
</svg>`);
}

async function makeCard(card) {
  const source = await sharp(card.source).resize(1080, 1240).ensureAlpha().png().toBuffer();
  const mask = await sharp(innerMaskSvg()).resize(1080, 1240).ensureAlpha().png().toBuffer();
  const inner = await sharp(source).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const border = await sharp(borderSvg(card.edge)).resize(1080, 1240).png().toBuffer();
  const output = await sharp({
    create: {
      width: 1080,
      height: 1240,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: border, blend: "over" },
      { input: inner, blend: "over" },
    ])
    .png()
    .toBuffer();

  await fs.writeFile(card.target, output);
  await fs.writeFile(card.preview, output);
}

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(conceptsDir, { recursive: true });

for (const card of cards) {
  await makeCard(card);
}

const previewItems = await Promise.all(
  cards.map(async (card, index) => ({
    input: await sharp(card.preview)
      .resize(420, 482, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    left: 90 + index * 510,
    top: 78,
  })),
);

await sharp({
  create: {
    width: 1100,
    height: 700,
    channels: 4,
    background: { r: 7, g: 11, b: 17, alpha: 1 },
  },
})
  .composite(previewItems)
  .png()
  .toFile(path.join(conceptsDir, "selected-border-only-contact.png"));

console.log("Generated border-only bronze-card.png and silver-card.png");
