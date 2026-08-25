// 팀 카드(브론즈/실버/골드/에메랄드) 렌더링을 단일 캔버스 함수로 통일.
// 랜딩 캐러셀(team-circular-gallery) 과 팀 상세 헤더(TeamEmblem) 가 같은
// 함수를 호출해 동일한 텍스처를 그린다 — 텍스트 크기/위치 차이로 인한 surface
// mismatch 를 차단하기 위함.

export interface TeamCardItem {
  name: string;
  // 로고가 없거나 로드 실패한 경우엔 프레임/텍스트만 그린다.
  logo?: string;
  frame: string;
  colorIndex: number;
  isFieldChampion?: boolean;
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

function getVisibleImageBounds(img: HTMLImageElement) {
  // 투명 여백 트리밍은 중심/contain 배치용이라 정밀할 필요가 없다. 로고 원본이
  // 1000px 이상이면 픽셀 스캔이 카드마다 수백만 회 돌아 메인스레드를 막으므로,
  // 스캔은 최대 256px 로 다운샘플해 O(상수) 로 고정한다(결과는 원본 좌표로 환산).
  const SCAN_MAX = 256;
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
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
  img: HTMLImageElement,
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

// 프레임 외곽 경로 — 골드/에메랄드 광채 효과가 따라가는 카드 윤곽.
function tracePremiumFramePath(ctx: CanvasRenderingContext2D, inset = 0) {
  const left = 235 + inset;
  const right = 845 - inset;
  const top = 95 + inset;
  const bottom = 1160 - inset;
  const center = 540;

  ctx.beginPath();
  ctx.moveTo(center, top);
  ctx.bezierCurveTo(590, 172, 676, 184, right, 166);
  ctx.bezierCurveTo(842, 222, 874, 270, 872, 344);
  ctx.bezierCurveTo(836, 380, 825, 455, 832, 558);
  ctx.bezierCurveTo(842, 707, 828, 862, 802, 989);
  ctx.bezierCurveTo(710, 996, 626, 1056, center, bottom);
  ctx.bezierCurveTo(454, 1056, 370, 996, 278, 989);
  ctx.bezierCurveTo(252, 862, 238, 707, 248, 558);
  ctx.bezierCurveTo(255, 455, 244, 380, 208, 344);
  ctx.bezierCurveTo(206, 270, 238, 222, left, 166);
  ctx.bezierCurveTo(404, 184, 490, 172, center, top);
}

function drawGoldFrameLight(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "screen";

  ctx.shadowColor = "rgba(255,210,74,0.42)";
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "rgba(255,198,58,0.52)";
  ctx.lineWidth = 10;
  tracePremiumFramePath(ctx, 10);
  ctx.stroke();

  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.58;
  ctx.strokeStyle = "rgba(255,239,170,0.68)";
  ctx.lineWidth = 4;
  tracePremiumFramePath(ctx, 18);
  ctx.stroke();

  ctx.restore();
}

function drawChampionSpark(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius * 0.28, y - radius * 0.28);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x + radius * 0.28, y + radius * 0.28);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius * 0.28, y + radius * 0.28);
  ctx.lineTo(x - radius, y);
  ctx.lineTo(x - radius * 0.28, y - radius * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawFieldChampionFrameEffect(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "screen";

  ctx.shadowColor = "rgba(0, 190, 255, 0.55)";
  ctx.shadowBlur = 30;
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = "rgba(0, 168, 255, 0.58)";
  ctx.lineWidth = 18;
  tracePremiumFramePath(ctx, -7);
  ctx.stroke();

  ctx.shadowColor = "rgba(255, 225, 110, 0.62)";
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = "rgba(255, 238, 150, 0.78)";
  ctx.lineWidth = 5;
  tracePremiumFramePath(ctx, 4);
  ctx.stroke();

  ctx.setLineDash([24, 18]);
  ctx.lineDashOffset = -10;
  ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.48;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 2.5;
  tracePremiumFramePath(ctx, 27);
  ctx.stroke();
  ctx.setLineDash([]);

  const sparks = [
    [540, 72, 16],
    [220, 210, 12],
    [862, 292, 11],
    [842, 932, 13],
    [540, 1186, 15],
    [244, 892, 10],
  ] as const;
  ctx.fillStyle = "rgba(255, 244, 175, 0.92)";
  ctx.shadowColor = "rgba(255, 219, 85, 0.9)";
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.9;
  sparks.forEach(([x, y, radius]) => drawChampionSpark(ctx, x, y, radius));

  ctx.restore();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
) {
  let size = startSize;
  do {
    ctx.font = `900 ${size}px Pretendard, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 3;
  } while (size > 42);
  return size;
}

export async function createTeamCardCanvas(
  item: TeamCardItem,
  opts?: { width?: number },
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  // 모든 드로잉 좌표는 1080×1240 논리 공간 기준이고, ctx.scale 로 실제 출력
  // 해상도를 맞춘다. 호출처가 표시 크기에 맞는 width 를 주면(예: 랜딩 마퀴
  // 200px 카드 → 540px) 캔버스 픽셀 수가 줄어 합성·메모리가 크게 감소한다.
  // 미지정 시 1080(상세 페이지/고DPR 대응).
  const scale = (opts?.width ?? 1080) / 1080;
  canvas.width = Math.round(1080 * scale);
  canvas.height = Math.round(1240 * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const [frame, logo] = await Promise.all([
    loadImage(item.frame),
    item.logo ? loadImage(item.logo).catch(() => null) : Promise.resolve(null),
  ]);

  // emerald(variant 3) PNG 는 본체 안쪽 콘텐츠가 다른 카드보다 캔버스에서
  // 작은 비율로 그려져 풀-사이즈로 그려도 시각적으로 작아 보인다. 캔버스 밖
  // 으로 ~9% over-draw 해서 다른 카드와 가시 크기를 맞춘다(잘리는 부분은
  // 장식 외곽 여백이라 시각적 손실 없음). 다른 variant 는 원본 좌표 유지.
  const isEmerald = item.colorIndex % 4 === 3;
  if (isEmerald) {
    const over = 0.04; // 4% over-draw (다른 카드와 가시 크기 정렬)
    const dx = -1080 * over * 0.5;
    const dy = -1240 * over * 0.5;
    const dw = 1080 * (1 + over);
    const dh = 1240 * (1 + over);
    ctx.drawImage(frame, dx, dy, dw, dh);
  } else if (item.colorIndex % 4 === 2) {
    ctx.drawImage(frame, 0, 0, 1080, 1240);
    drawGoldFrameLight(ctx);
  } else {
    ctx.drawImage(frame, 0, 0, 1080, 1240);
  }

  if (logo) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.34)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 18;
    if (
      item.name.includes("마포 레인저스") ||
      item.name.includes("관악 드리머스")
    ) {
      drawContain(ctx, logo, 314, 305, 453, 377);
    } else {
      drawContain(ctx, logo, 289, 284, 503, 419);
    }
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = fitFont(ctx, item.name, 560, 54);
  ctx.font = `900 ${fontSize}px Pretendard, Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  // emerald(variant 3) plate-bottom 정렬을 위해 nameY 만 945, 마포는 로고 위치
  // 보정 920, 그 외 기본 850. (isEmerald 는 위에서 이미 선언.)
  const nameY = item.name.includes("마포 레인저스")
    ? 920
    : isEmerald
      ? 945
      : 850;
  ctx.fillText(item.name, 540, nameY);
  ctx.restore();

  if (item.isFieldChampion) {
    drawFieldChampionFrameEffect(ctx);
  }

  return canvas;
}
