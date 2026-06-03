"use client";

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import { useEffect, useRef } from "react";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";

const cn = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" ");

export interface TeamGalleryItem {
  id: string;
  name: string;
  logo?: string;
  frame: string;
  colorIndex: number;
}

interface TeamCircularGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TeamGalleryItem[];
  onItemClick?: (item: TeamGalleryItem) => void;
  bend?: number;
  scrollSpeed?: number;
  scrollEase?: number;
  autoSpeed?: number;
}

function debounce(fn: () => void, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, wait);
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// 카드 텍스처 생성은 lib/team-card-canvas.ts 의 createTeamCardCanvas 로 통일.
// emerald 프레임 효과(createEmeraldFrameEffects/tracePremiumFramePath 등)는
// 이 카드 텍스처와 무관한 별도의 글로벌 effect 라 그대로 둔다.

function createEmeraldFrameEffects(frame: HTMLImageElement) {
  const mask = document.createElement("canvas");
  mask.width = 1080;
  mask.height = 1240;
  const maskCtx = mask.getContext("2d", { willReadFrequently: true })!;
  maskCtx.drawImage(frame, 0, 0, mask.width, mask.height);

  const image = maskCtx.getImageData(0, 0, mask.width, mask.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const isFrameHighlight = a > 18 && g > 86 && g > r * 1.12 && b > r * 0.72 && Math.max(r, g, b) > 104;

    if (!isFrameHighlight) {
      data[i + 3] = 0;
      continue;
    }

    data[i] = 12;
    data[i + 1] = 255;
    data[i + 2] = 196;
    data[i + 3] = Math.min(210, Math.round(a * 0.9));
  }

  maskCtx.putImageData(image, 0, 0);

  const outsideGlow = document.createElement("canvas");
  outsideGlow.width = mask.width;
  outsideGlow.height = mask.height;
  const outsideCtx = outsideGlow.getContext("2d")!;
  outsideCtx.filter = "blur(58px)";
  outsideCtx.globalAlpha = 0.46;
  outsideCtx.drawImage(mask, 0, 0);
  outsideCtx.filter = "blur(30px)";
  outsideCtx.globalAlpha = 0.38;
  outsideCtx.drawImage(mask, 0, 0);
  outsideCtx.filter = "blur(18px)";
  outsideCtx.globalAlpha = 0.26;
  outsideCtx.drawImage(mask, 0, 0);

  outsideCtx.globalCompositeOperation = "destination-out";
  outsideCtx.filter = "none";
  outsideCtx.globalAlpha = 1;
  outsideCtx.drawImage(frame, 0, 0, mask.width, mask.height);

  const frameLight = document.createElement("canvas");
  frameLight.width = mask.width;
  frameLight.height = mask.height;
  const frameLightCtx = frameLight.getContext("2d")!;
  frameLightCtx.filter = "blur(7px)";
  frameLightCtx.globalAlpha = 0.52;
  frameLightCtx.drawImage(mask, 0, 0);
  frameLightCtx.filter = "blur(2px)";
  frameLightCtx.globalAlpha = 0.72;
  frameLightCtx.drawImage(mask, 0, 0);
  frameLightCtx.filter = "none";
  frameLightCtx.globalAlpha = 0.46;
  frameLightCtx.drawImage(mask, 0, 0);

  return { outsideGlow, frameLight };
}

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

function drawPremiumFrameOuterBloom(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  ctx.shadowColor = "rgba(18,255,190,0.78)";
  ctx.shadowBlur = 96;
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = "rgba(18,255,190,0.36)";
  ctx.lineWidth = 34;
  tracePremiumFramePath(ctx, 8);
  ctx.stroke();

  ctx.shadowBlur = 58;
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "rgba(22,255,194,0.44)";
  ctx.lineWidth = 24;
  tracePremiumFramePath(ctx, 8);
  ctx.stroke();

  ctx.restore();
}

function drawPremiumFrameLight(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "screen";

  ctx.shadowColor = "rgba(18,255,190,0.5)";
  ctx.shadowBlur = 28;
  ctx.globalAlpha = 0.68;
  ctx.strokeStyle = "rgba(28,255,200,0.72)";
  ctx.lineWidth = 13;
  tracePremiumFramePath(ctx, 8);
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = "rgba(32,255,203,0.66)";
  ctx.lineWidth = 8;
  tracePremiumFramePath(ctx, 8);
  ctx.stroke();

  ctx.shadowBlur = 12;
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = "rgba(196,255,239,0.88)";
  ctx.lineWidth = 5;
  tracePremiumFramePath(ctx, 17);
  ctx.stroke();

  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.58;
  ctx.strokeStyle = "rgba(0,255,183,0.7)";
  ctx.lineWidth = 4;
  tracePremiumFramePath(ctx, 45);
  ctx.stroke();

  ctx.restore();
}

// drawGoldFrameLight / fitFont / createTeamCardTexture 는 lib/team-card-canvas.ts
// 로 이전. Media 클래스의 createTeamCardTexture 호출도 createTeamCardCanvas 로 교체.

class Media {
  geometry: Plane;
  gl: Renderer["gl"];
  item: TeamGalleryItem;
  index: number;
  length: number;
  scene: Transform;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
  bend: number;
  program!: Program;
  plane!: Mesh;
  extra = 0;
  widthTotal = 0;
  width = 0;
  x = 0;
  padding = 1.35;
  isBefore = false;
  isAfter = false;

  constructor({
    geometry,
    gl,
    item,
    index,
    length,
    scene,
    screen,
    viewport,
    bend,
  }: {
    geometry: Plane;
    gl: Renderer["gl"];
    item: TeamGalleryItem;
    index: number;
    length: number;
    scene: Transform;
    screen: { width: number; height: number };
    viewport: { width: number; height: number };
    bend: number;
  }) {
    this.geometry = geometry;
    this.gl = gl;
    this.item = item;
    this.index = index;
    this.length = length;
    this.scene = scene;
    this.screen = screen;
    this.viewport = viewport;
    this.bend = bend;
    this.createShader();
    this.createMesh();
    this.onResize();
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: true });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform sampler2D tMap;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tMap, vUv);
          if (color.a < 0.01) discard;
          gl_FragColor = color;
        }
      `,
      uniforms: {
        tMap: { value: texture },
      },
      transparent: true,
    });

    void createTeamCardCanvas(this.item).then((canvas) => {
      texture.image = canvas;
    });
  }

  createMesh() {
    this.plane = new Mesh(this.gl, { geometry: this.geometry, program: this.program });
    this.plane.setParent(this.scene);
  }

  update(scroll: { current: number; last: number }, direction: "left" | "right") {
    this.plane.position.x = this.x - scroll.current - this.extra;

    const x = this.plane.position.x;
    const halfViewport = this.viewport.width / 2;
    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const bend = Math.abs(this.bend);
      const radius = (halfViewport * halfViewport + bend * bend) / (2 * bend);
      const effectiveX = Math.min(Math.abs(x), halfViewport);
      const arc = radius - Math.sqrt(radius * radius - effectiveX * effectiveX);
      this.plane.position.y = this.bend > 0 ? -arc : arc;
      this.plane.rotation.z = (this.bend > 0 ? -1 : 1) * Math.sign(x) * Math.asin(effectiveX / radius);
    }
    // emerald(variant 3) 만 살짝 위로 올려 다른 카드의 본체 baseline 과
    // 시각적으로 맞춘다. 과거 5.5% 는 과해서 솟구쳐 보였고, 0% 는 약간 처져
    // 보였다. 2% 가 절충점.
    if (this.item.colorIndex % 4 === 3) {
      this.plane.position.y += this.plane.scale.y * 0.02;
    }

    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;

    if (direction === "right" && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === "left" && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }

  onResize({ screen, viewport }: { screen?: { width: number; height: number }; viewport?: { width: number; height: number } } = {}) {
    if (screen) this.screen = screen;
    if (viewport) this.viewport = viewport;

    const cardHeight = this.viewport.height * (this.screen.width < 768 ? 0.78 : 0.94);
    const cardWidth = cardHeight * (1080 / 1240);
    this.plane.scale.y = cardHeight;
    this.plane.scale.x = cardWidth;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

class GalleryApp {
  container: HTMLElement;
  items: TeamGalleryItem[];
  onItemClick?: (item: TeamGalleryItem) => void;
  scrollSpeed: number;
  autoSpeed: number;
  scroll: { ease: number; current: number; target: number; last: number; position: number };
  renderer!: Renderer;
  gl!: Renderer["gl"];
  camera!: Camera;
  scene!: Transform;
  geometry!: Plane;
  medias!: Media[];
  screen!: { width: number; height: number };
  viewport!: { width: number; height: number };
  raf = 0;
  isDown = false;
  start = 0;
  startY = 0;
  moved = 0;
  movedY = 0;
  lastInteraction = 0;
  onCheckDebounce: () => void;

  constructor(
    container: HTMLElement,
    {
      items,
      bend,
      scrollSpeed,
      scrollEase,
      autoSpeed,
      onItemClick,
    }: {
      items: TeamGalleryItem[];
      bend: number;
      scrollSpeed: number;
      scrollEase: number;
      autoSpeed: number;
      onItemClick?: (item: TeamGalleryItem) => void;
    }
  ) {
    this.container = container;
    this.items = items;
    this.onItemClick = onItemClick;
    this.scrollSpeed = scrollSpeed;
    this.autoSpeed = autoSpeed;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0, position: 0 };
    this.onCheckDebounce = debounce(this.onCheck, 180);

    this.createRenderer();
    this.createCamera();
    this.scene = new Transform();
    this.onResize();
    this.geometry = new Plane(this.gl, { heightSegments: 1, widthSegments: 1 });
    this.createMedias(bend);
    this.addEventListeners();
    this.update();
  }

  createRenderer = () => {
    this.renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  };

  createCamera = () => {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  };

  createMedias = (bend: number) => {
    const source = this.items.length > 1 ? [...this.items, ...this.items] : this.items;
    this.medias = source.map((item, index) => new Media({
      geometry: this.geometry,
      gl: this.gl,
      item,
      index,
      length: source.length,
      scene: this.scene,
      screen: this.screen,
      viewport: this.viewport,
      bend,
    }));
  };

  onResize = () => {
    this.screen = { width: this.container.clientWidth, height: this.container.clientHeight };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    this.medias?.forEach((media) => media.onResize({ screen: this.screen, viewport: this.viewport }));
  };

  onTouchDown = (event: MouseEvent | TouchEvent) => {
    this.isDown = true;
    this.moved = 0;
    this.movedY = 0;
    this.lastInteraction = Date.now();
    this.scroll.position = this.scroll.current;
    this.start = "touches" in event ? event.touches[0].clientX : event.clientX;
    this.startY = "touches" in event ? event.touches[0].clientY : event.clientY;
  };

  onTouchMove = (event: MouseEvent | TouchEvent) => {
    if (!this.isDown) return;
    const x = "touches" in event ? event.touches[0].clientX : event.clientX;
    const y = "touches" in event ? event.touches[0].clientY : event.clientY;
    const distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.moved = Math.max(this.moved, Math.abs(this.start - x));
    this.movedY = Math.max(this.movedY, Math.abs(this.startY - y));
    this.scroll.target = this.scroll.position + distance;
  };

  onTouchUp = (event?: MouseEvent | TouchEvent) => {
    // 갤러리에서 시작한 상호작용만 처리. window 전역 리스너라, 히어로 등
    // 다른 영역을 스크롤하다 손을 떼면 isDown=false → 여기서 종료해야
    // 탭으로 오인되어 팀 페이지로 자동 이동하는 버그를 막는다.
    if (!this.isDown) return;
    this.isDown = false;
    this.lastInteraction = Date.now();
    // 탭 판정: 작은 움직임만 탭으로. 세로 스크롤(movedY 큼, 보통 30px+)은 탭 아님.
    // 모바일에서 손가락 미세 흔들림으로 탭이 누락되지 않도록 임계값을 넉넉히.
    if (this.moved < 14 && this.movedY < 18 && event) {
      const clientX =
        "changedTouches" in event
          ? event.changedTouches[0]?.clientX
          : (event as MouseEvent).clientX;
      if (clientX != null) {
        // Map screen X to OGL viewport coords (centered at 0). A card is
        // only "clicked" when the tap falls inside its plane width.
        //
        // items 가 [...items, ...items] 로 중복되어 있어 동일 팀의 사본이 두
        // 개씩 존재한다. 또 wrap-around 시점에는 인접 카드의 hit zone 이 잠시
        // 겹칠 수 있다. find() 로 첫 매치를 잡으면 visually-centered 카드가
        // 아닌, 배열 앞쪽 사본/인접 카드가 잡혀 엉뚱한 팀으로 라우팅됐다.
        // 해결: 클릭점과 가장 가까운 media 를 선택(거리 최소).
        const rect = this.container.getBoundingClientRect();
        const relativeX = clientX - rect.left - rect.width / 2;
        const viewportX = (relativeX / rect.width) * this.viewport.width;
        // 가장 가까운(거리 최소) 카드를 선택. 카드 경계(halfWidth) 밖을 탭해도
        // 가장 가까운 카드가 잡히도록 해 모바일에서 탭이 누락되지 않게 한다.
        let closest: Media | null = null;
        let closestDist = Infinity;
        for (const media of this.medias) {
          const dist = Math.abs(viewportX - media.plane.position.x);
          if (dist < closestDist) {
            closestDist = dist;
            closest = media;
          }
        }
        if (closest) {
          this.onItemClick?.(closest.item);
        }
      }
    }
    this.onCheck();
  };

  onWheel = (event: WheelEvent) => {
    const delta = event.deltaY || event.deltaX;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.lastInteraction = Date.now();
    this.onCheckDebounce();
  };

  onCheck = () => {
    if (!this.medias?.[0]) return;
    const width = this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    const item = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
  };

  update = () => {
    if (!this.isDown && Date.now() - this.lastInteraction > 1000) {
      this.scroll.target += this.autoSpeed;
    }
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? "right" : "left";
    this.medias?.forEach((media) => media.update(this.scroll, direction));
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update);
  };

  addEventListeners = () => {
    window.addEventListener("resize", this.onResize);
    this.container.addEventListener("wheel", this.onWheel, { passive: true });
    this.container.addEventListener("mousedown", this.onTouchDown);
    window.addEventListener("mousemove", this.onTouchMove);
    window.addEventListener("mouseup", this.onTouchUp);
    this.container.addEventListener("touchstart", this.onTouchDown, { passive: true });
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("touchend", this.onTouchUp);
  };

  destroy = () => {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.container.removeEventListener("wheel", this.onWheel);
    this.container.removeEventListener("mousedown", this.onTouchDown);
    window.removeEventListener("mousemove", this.onTouchMove);
    window.removeEventListener("mouseup", this.onTouchUp);
    this.container.removeEventListener("touchstart", this.onTouchDown);
    window.removeEventListener("touchmove", this.onTouchMove);
    window.removeEventListener("touchend", this.onTouchUp);
    this.gl.canvas.remove();
  };
}

export function TeamCircularGallery({
  items,
  onItemClick,
  bend = 0,
  scrollSpeed = 2,
  scrollEase = 0.055,
  autoSpeed = 0.012,
  className,
  ...props
}: TeamCircularGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onItemClickRef = useRef(onItemClick);
  onItemClickRef.current = onItemClick;

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;
    const app = new GalleryApp(containerRef.current, {
      items,
      bend,
      scrollSpeed,
      scrollEase,
      autoSpeed,
      onItemClick: (item) => onItemClickRef.current?.(item),
    });
    return () => app.destroy();
  }, [items, bend, scrollSpeed, scrollEase, autoSpeed]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full cursor-grab overflow-hidden active:cursor-grabbing", className)}
      {...props}
    />
  );
}
