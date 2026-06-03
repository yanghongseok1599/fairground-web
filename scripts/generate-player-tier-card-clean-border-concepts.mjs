import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.join(process.cwd(), "public/images/player-card-tier-concepts");

const variants = [
  {
    label: "ROSE COPPER",
    file: "bronze-rose-clean-border.png",
    shadow: "#4d211a",
    ink: "#321711",
    glow: "rgba(255, 122, 93, 0.32)",
    edgeStops: [
      ["0%", "#ffe0cf"],
      ["18%", "#d4785e"],
      ["42%", "#7d372c"],
      ["68%", "#f1a17f"],
      ["100%", "#5c271f"],
    ],
    faceStops: [
      ["0%", "#ffe5d7"],
      ["34%", "#d78970"],
      ["66%", "#f2b596"],
      ["100%", "#8f4636"],
    ],
    panelStops: [
      ["0%", "#fff1e7"],
      ["52%", "#d69175"],
      ["100%", "#a55641"],
    ],
  },
  {
    label: "CLEAN PLATINUM",
    file: "silver-platinum-clean-border.png",
    shadow: "#31404e",
    ink: "#172334",
    glow: "rgba(210, 232, 255, 0.34)",
    edgeStops: [
      ["0%", "#ffffff"],
      ["20%", "#c9d4df"],
      ["45%", "#677787"],
      ["70%", "#eef4fb"],
      ["100%", "#526170"],
    ],
    faceStops: [
      ["0%", "#ffffff"],
      ["35%", "#dce6ef"],
      ["66%", "#f7fbff"],
      ["100%", "#8d9aa8"],
    ],
    panelStops: [
      ["0%", "#ffffff"],
      ["54%", "#e1e8ef"],
      ["100%", "#aab6c1"],
    ],
  },
];

function stops(id, stops) {
  return `<linearGradient id="${id}" x1="18%" y1="4%" x2="86%" y2="98%">
${stops.map(([offset, color]) => `      <stop offset="${offset}" stop-color="${color}"/>`).join("\n")}
    </linearGradient>`;
}

function cardSvg(variant) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1240">
  <defs>
    ${stops("edge", variant.edgeStops)}
    ${stops("face", variant.faceStops)}
    ${stops("panel", variant.panelStops)}
    <linearGradient id="cut" x1="190" y1="128" x2="886" y2="1090" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0.38"/>
      <stop offset="0.34" stop-color="#fff" stop-opacity="0.06"/>
      <stop offset="0.56" stop-color="#000" stop-opacity="0.12"/>
      <stop offset="0.82" stop-color="#fff" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
    </linearGradient>
    <radialGradient id="shine" cx="32%" cy="18%" r="66%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.7"/>
      <stop offset="0.38" stop-color="#fff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-16%" y="-16%" width="132%" height="132%">
      <feDropShadow dx="0" dy="18" stdDeviation="15" flood-color="#000" flood-opacity="0.28"/>
      <feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="${variant.glow}" flood-opacity="1"/>
    </filter>
    <filter id="soften">
      <feGaussianBlur stdDeviation="0.35"/>
    </filter>
  </defs>

  <g filter="url(#shadow)">
    <path d="M216 246 C216 204 248 172 290 172 L390 172 C430 172 494 118 540 82 C586 118 650 172 690 172 L790 172 C832 172 864 204 864 246 L864 792 C864 890 782 1002 540 1154 C298 1002 216 890 216 792 Z" fill="url(#edge)"/>

    <path d="M252 258 C252 230 274 208 302 208 L400 208 C444 208 502 158 540 126 C578 158 636 208 680 208 L778 208 C806 208 828 230 828 258 L828 774 C828 858 756 960 540 1098 C324 960 252 858 252 774 Z" fill="url(#face)"/>

    <path d="M252 258 C252 230 274 208 302 208 L400 208 C444 208 502 158 540 126 C578 158 636 208 680 208 L778 208 C806 208 828 230 828 258 L828 774 C828 858 756 960 540 1098 C324 960 252 858 252 774 Z" fill="url(#cut)" opacity="0.58"/>

    <path d="M286 252 L794 252 L794 548 L286 548 Z" fill="url(#face)" opacity="0.72"/>
    <path d="M286 548 L794 548 L794 760 C794 838 724 922 540 1038 C356 922 286 838 286 760 Z" fill="url(#panel)" opacity="0.88"/>
    <path d="M286 548 L794 548" stroke="${variant.shadow}" stroke-width="7" opacity="0.28"/>
    <path d="M306 594 C382 578 456 570 540 570 C624 570 698 578 774 594" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.36"/>
    <path d="M342 784 C404 846 466 892 540 936 C614 892 676 846 738 784" fill="none" stroke="${variant.shadow}" stroke-width="8" stroke-linecap="round" opacity="0.22"/>

    <path d="M250 532 L286 548 M830 532 L794 548" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity="0.34"/>
    <path d="M282 244 C326 214 390 224 434 206 C472 190 505 154 540 126 C575 154 608 190 646 206 C690 224 754 214 798 244" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity="0.4"/>
    <path d="M540 100 C566 128 594 154 624 176 C586 168 558 152 540 132 C522 152 494 168 456 176 C486 154 514 128 540 100 Z" fill="#fff" opacity="0.2"/>

    <path d="M216 246 C216 204 248 172 290 172 L390 172 C430 172 494 118 540 82 C586 118 650 172 690 172 L790 172 C832 172 864 204 864 246 L864 792 C864 890 782 1002 540 1154 C298 1002 216 890 216 792 Z" fill="none" stroke="#fff" stroke-width="10" opacity="0.58"/>
    <path d="M252 258 C252 230 274 208 302 208 L400 208 C444 208 502 158 540 126 C578 158 636 208 680 208 L778 208 C806 208 828 230 828 258 L828 774 C828 858 756 960 540 1098 C324 960 252 858 252 774 Z" fill="none" stroke="${variant.shadow}" stroke-width="8" opacity="0.24"/>
    <path d="M286 454 C414 428 540 318 674 184" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity="0.22" filter="url(#soften)"/>
    <path d="M394 488 C548 450 660 330 790 224" stroke="${variant.shadow}" stroke-width="13" stroke-linecap="round" opacity="0.15"/>
    <path d="M252 258 C252 230 274 208 302 208 L400 208 C444 208 502 158 540 126 C578 158 636 208 680 208 L778 208 C806 208 828 230 828 258 L828 774 C828 858 756 960 540 1098 C324 960 252 858 252 774 Z" fill="url(#shine)"/>
  </g>
</svg>`);
}

function labelSvg(variant) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="70" viewBox="0 0 420 70">
  <text x="210" y="42" text-anchor="middle" fill="#eef4ff" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" letter-spacing="2">${variant.label}</text>
</svg>`);
}

await fs.mkdir(outDir, { recursive: true });

for (const variant of variants) {
  const image = await sharp(cardSvg(variant)).resize(1080, 1240).png().toBuffer();
  await fs.writeFile(path.join(outDir, variant.file), image);
}

const composites = [];
for (let i = 0; i < variants.length; i += 1) {
  const variant = variants[i];
  composites.push({
    input: await sharp(path.join(outDir, variant.file))
      .resize(420, 482, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    left: 90 + i * 510,
    top: 78,
  });
  composites.push({
    input: labelSvg(variant),
    left: 90 + i * 510,
    top: 590,
  });
}

const contact = await sharp({
  create: {
    width: 1100,
    height: 700,
    channels: 4,
    background: { r: 7, g: 11, b: 17, alpha: 1 },
  },
})
  .composite(composites)
  .png()
  .toBuffer();

await fs.writeFile(path.join(outDir, "clean-border-selected-contact.png"), contact);
console.log(`Generated flat clean border concepts in ${outDir}`);
