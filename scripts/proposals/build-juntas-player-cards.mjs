import sharp from "sharp";

const cards = [
  {
    source: ".codex_tmp-card-male-photo.png",
    output: "public/proposals/juntas/card-male-v3.png",
    rating: "104",
    position: "PIVO",
    name: "김도현",
    stats: [
      ["14", "골"],
      ["7", "도움"],
      ["14", "경기"],
      ["5", "MOM"],
    ],
  },
  {
    source: ".codex_tmp-card-female-photo.png",
    output: "public/proposals/juntas/card-female-v3.png",
    rating: "102",
    position: "ALA",
    name: "이서연",
    stats: [
      ["11", "골"],
      ["12", "도움"],
      ["14", "경기"],
      ["4", "MOM"],
    ],
  },
];

const width = 720;
const height = 900;
const photoHeight = 650;

for (const card of cards) {
  const photo = await sharp(card.source)
    .resize(width, photoHeight, { fit: "cover", position: "north" })
    .png()
    .toBuffer();

  const statColumns = card.stats
    .map(
      ([value, label], index) => `
        <g transform="translate(${72 + index * 150} 0)">
          <text x="0" y="826" fill="#ffffff" font-size="34" font-weight="800">${value}</text>
          <text x="0" y="856" fill="#9cadc2" font-size="16" font-weight="600">${label}</text>
        </g>`,
    )
    .join("");

  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="42%" stop-color="#071a33" stop-opacity="0"/>
          <stop offset="100%" stop-color="#071a33" stop-opacity="1"/>
        </linearGradient>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#58d5b5"/>
          <stop offset="1" stop-color="#1d6d87"/>
        </linearGradient>
        <clipPath id="cardClip"><rect x="8" y="8" width="704" height="884" rx="32"/></clipPath>
      </defs>
      <g clip-path="url(#cardClip)">
        <rect y="0" width="720" height="650" fill="url(#photoFade)"/>
        <rect x="0" y="646" width="720" height="254" fill="#071a33"/>
        <rect x="0" y="646" width="720" height="4" fill="url(#edge)"/>
      </g>
      <rect x="9" y="9" width="702" height="882" rx="31" fill="none" stroke="url(#edge)" stroke-width="3"/>
      <text x="48" y="82" fill="#ffffff" font-family="Pretendard, sans-serif" font-size="62" font-weight="900" letter-spacing="-2">${card.rating}</text>
      <text x="51" y="114" fill="#71e0c1" font-family="Pretendard, sans-serif" font-size="18" font-weight="800" letter-spacing="3">${card.position}</text>
      <text x="48" y="718" fill="#71e0c1" font-family="Pretendard, sans-serif" font-size="14" font-weight="700" letter-spacing="4">FAIRGROUND PLAYER CARD</text>
      <text x="48" y="775" fill="#ffffff" font-family="Pretendard, sans-serif" font-size="42" font-weight="900" letter-spacing="-1">${card.name}</text>
      <line x1="48" y1="794" x2="672" y2="794" stroke="#27445e" stroke-width="1"/>
      ${statColumns}
    </svg>
  `);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#071a33",
    },
  })
    .composite([
      { input: photo, left: 0, top: 0 },
      { input: overlay, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(card.output);
}
