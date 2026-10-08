import { prepareTeamCardLogo } from "@/lib/team-card-logo";
import { getTeamCardAppearance, TEAM_CARD_SIZE, TEAM_CARD_TIER_ORDER } from "@/lib/team-card-appearance";
import type { CardType } from "@/types";

// 팀 카드(브론즈/실버/골드/플래티넘) 렌더링을 단일 캔버스 함수로 통일.
// 랜딩 캐러셀(team-circular-gallery) 과 팀 상세 헤더(TeamEmblem) 가 같은
// 함수를 호출해 동일한 텍스처를 그린다 — 텍스트 크기/위치 차이로 인한 surface
// mismatch 를 차단하기 위함.

export interface TeamCardItem {
  id?: string;
  name: string;
  // 로고가 없거나 로드 실패한 경우엔 프레임/텍스트만 그린다.
  logo?: string;
  frame: string;
  colorIndex: number;
  tier?: CardType;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type TeamLogoSource = HTMLImageElement | HTMLCanvasElement;

function getVisibleImageBounds(img: TeamLogoSource) {
  // 투명 여백 트리밍은 중심/contain 배치용이라 정밀할 필요가 없다. 로고 원본이
  // 1000px 이상이면 픽셀 스캔이 카드마다 수백만 회 돌아 메인스레드를 막으므로,
  // 스캔은 최대 256px 로 다운샘플해 O(상수) 로 고정한다(결과는 원본 좌표로 환산).
  const SCAN_MAX = 256;
  const natW = "naturalWidth" in img ? img.naturalWidth || img.width : img.width;
  const natH = "naturalHeight" in img ? img.naturalHeight || img.height : img.height;
  const s = Math.min(1, SCAN_MAX / Math.max(natW, natH));
  const sw = Math.max(1, Math.round(natW * s));
  const sh = Math.max(1, Math.round(natH * s));

  const scratch = document.createElement("canvas");
  scratch.width = sw;
  scratch.height = sh;
  const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;
  scratchCtx.drawImage(img, 0, 0, sw, sh);
  const { data } = scratchCtx.getImageData(0, 0, sw, sh);
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;

  for (let py = 0; py < sh; py += 1) {
    for (let px = 0; px < sw; px += 1) {
      if (data[(py * sw + px) * 4 + 3] < 16) continue;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: natW, height: natH };
  }
  const inv = 1 / s;
  return {
    x: minX * inv,
    y: minY * inv,
    width: (maxX - minX + 1) * inv,
    height: (maxY - minY + 1) * inv,
  };
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: TeamLogoSource,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // 투명 패딩을 무시하고 실제 보이는 픽셀 영역만 contain 으로 채운다.
  // 팀 로고 PNG 들이 종종 큰 투명 여백을 가져 그대로 그리면 시각적으로
  // 작아 보이는 문제를 해결.
  const bounds = getVisibleImageBounds(img);
  const scale = Math.min(w / bounds.width, h / bounds.height);
  const dw = bounds.width * scale;
  const dh = bounds.height * scale;
  ctx.drawImage(
    img,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    x + (w - dw) / 2,
    y + (h - dh) / 2,
    dw,
    dh,
  );
}

// 반짝임은 승인된 플래티넘 원본에만 들어 있다. 합성 시 효과를 덧그리지 않는다.
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  while (true) {
    ctx.font = `900 ${size}px Pretendard, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
    size = Math.max(minSize, size - 1);
  }
  return size;
}

export async function createTeamCardCanvas(
  item: TeamCardItem,
  opts?: { width?: number },
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  // 1024×1536 원본 좌표를 모든 화면·내보내기에서 함께 사용한다.
  const scale = (opts?.width ?? TEAM_CARD_SIZE.width) / TEAM_CARD_SIZE.width;
  canvas.width = Math.round(TEAM_CARD_SIZE.width * scale);
  canvas.height = Math.round(TEAM_CARD_SIZE.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const [frame, logo] = await Promise.all([
    loadImage(item.frame),
    item.logo ? loadImage(item.logo).catch(() => null) : Promise.resolve(null),
    document.fonts?.ready,
  ]);

  const appearance = getTeamCardAppearance(item.tier ?? TEAM_CARD_TIER_ORDER[item.colorIndex]);
  ctx.drawImage(frame, 0, 0, TEAM_CARD_SIZE.width, TEAM_CARD_SIZE.height);

  if (logo) {
    const cardLogo = prepareTeamCardLogo(logo, item.id);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    const { x, y, width, height } = appearance.logo;
    drawContain(ctx, cardLogo, x, y, width, height);
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const plate = appearance.nameplate;
  const fontSize = fitFont(ctx, item.name, plate.maxWidth, plate.fontSize, plate.minFontSize);
  ctx.font = `900 ${fontSize}px Pretendard, Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillText(item.name, plate.x, plate.y, plate.maxWidth);
  ctx.restore();

  return canvas;
}
