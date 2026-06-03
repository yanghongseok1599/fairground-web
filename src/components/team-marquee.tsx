"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// 팀 카드 가로 마퀴 슬라이더.
//   • 자동 회전: 카드 세트를 화면을 채울 만큼 복제해 한 세트 너비마다 위치를 되돌려
//     끊김 없이 무한히 흐른다(setInterval 점프가 아니라 매 프레임 rAF 연속 이동).
//   • 데스크톱: 마우스 드래그 + 좌우 화살표 + 키보드 ←/→ 로도 넘길 수 있다.
//   • 모바일: 네이티브 터치 스크롤(드래그 핸들러는 touch 포인터를 건드리지 않음).
//   • 일시정지: 호버 / 포커스 / 드래그 중 / paused prop(예: 카드 선택 시).
//   • 접근성: prefers-reduced-motion 이면 자동 회전을 끄고 수동 조작만 남긴다.
// 카드 컴포넌트(HomeTeamCard·TeamCardButton)가 화면마다 달라 renderItem 으로 주입.

const ARROW_STEP = 432; // 화살표 1클릭 이동량(카드 ~2장)

export function TeamMarquee<T extends { id: string }>({
  items,
  renderItem,
  paused = false,
  reducedMotion = false,
  edgeClassName = "",
  speed = 50,
  ariaLabel = "팀 카드 슬라이더",
}: {
  items: T[];
  renderItem: (item: T, key: string) => ReactNode;
  /** 외부에서 강제 일시정지(예: 카드 선택으로 하단 패널이 열렸을 때). */
  paused?: boolean;
  /** prefers-reduced-motion 결과. true 면 자동 회전 비활성. */
  reducedMotion?: boolean;
  /** 좌우 엣지 블리드용 음수 마진/패딩 클래스(화면마다 다름). */
  edgeClassName?: string;
  /** 자동 회전 속도(px/초). */
  speed?: number;
  ariaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [reps, setReps] = useState(2);

  const autoEnabled = !reducedMotion && items.length > 1;

  // 일시정지 사유들 — rAF 클로저가 항상 최신값을 보도록 ref 로 관리.
  // (호버로는 멈추지 않는다 — 마우스를 올려도 계속 회전.)
  const pausedRef = useRef(paused);
  const focusRef = useRef(false);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });
  const raf = useRef<number | undefined>(undefined);
  const last = useRef<number | undefined>(undefined);
  // 자체 float 위치 누적기 — scrollLeft 를 직접 읽어 더하면 1px 미만 증분이
  // 반올림으로 사라져 멈춘 것처럼 보인다. pos 에 소수까지 누적해 매 프레임 적용.
  const pos = useRef<number | null>(null);
  // 화살표/키보드 조작 직후 잠깐 자동 구동을 멈추고 네이티브 smooth 스크롤에 양보.
  const manualUntil = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // 복제 세트(한 세트 너비)를 measure 해서 뷰포트를 채우고 남을 만큼만 복제.
  // 카드 폭이 화면마다 달라도 DOM 측정 기반이라 안전하다.
  useEffect(() => {
    if (!autoEnabled) {
      setReps(1);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const setW = el.scrollWidth / reps;
    if (setW <= 0) return;
    const needed = Math.ceil(el.clientWidth / setW) + 2; // 뷰포트 + 버퍼
    if (needed > reps) setReps(needed);
  }, [autoEnabled, items.length, reps]);

  const track = useMemo(
    () =>
      Array.from({ length: reps }).flatMap((_, r) =>
        items.map((it) => ({ it, r })),
      ),
    [items, reps],
  );

  // 한 세트 너비만큼 넘어가면 위치를 되돌려 끊김 없이 이어붙인다.
  const wrap = useCallback(() => {
    const el = scrollRef.current;
    if (!el || reps <= 1) return;
    const unit = el.scrollWidth / reps;
    if (unit <= 0) return;
    if (el.scrollLeft >= unit) el.scrollLeft -= unit;
    else if (el.scrollLeft < 0) el.scrollLeft += unit;
  }, [reps]);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < max - 1);
  }, []);

  // 자동 회전 루프
  useEffect(() => {
    if (!autoEnabled) return;
    const step = (t: number) => {
      const el = scrollRef.current;
      const dt = last.current === undefined ? 0 : t - last.current;
      last.current = t;
      if (el && dt > 0) {
        const manual = t < manualUntil.current;
        const idle =
          !pausedRef.current &&
          !focusRef.current &&
          !drag.current.active &&
          !manual;
        if (pos.current === null) pos.current = el.scrollLeft;
        if (idle) {
          pos.current += (speed * dt) / 1000;
          const unit = reps > 1 ? el.scrollWidth / reps : el.scrollWidth;
          if (unit > 0) {
            if (pos.current >= unit) pos.current -= unit;
            else if (pos.current < 0) pos.current += unit;
          }
          el.scrollLeft = pos.current;
        } else {
          // 사용자 조작/일시정지 중엔 실제 위치를 따라가, 재개 시 그 지점부터 이어감.
          pos.current = el.scrollLeft;
        }
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = undefined;
    };
  }, [autoEnabled, speed, reps]);

  useEffect(() => {
    updateArrows();
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateArrows, track.length]);

  const scrollByCards = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * ARROW_STEP, behavior: "smooth" });
    // smooth 스크롤이 끝날 때까지 자동 구동을 잠시 멈춘다(같은 시간 도메인).
    manualUntil.current = (last.current ?? 0) + 600;
  };

  // ── 마우스/펜 드래그(터치는 네이티브 스크롤에 맡김) ──
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = scrollRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
    wrap();
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* capture 미설정 시 무시 */
      }
    }
    drag.current.active = false;
  };
  // 드래그로 스크롤한 직후의 클릭은 선택으로 이어지지 않게 막는다.
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByCards(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByCards(-1);
    }
  };

  const arrowBtn =
    "absolute top-[calc(50%-14px)] hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition-transform hover:-translate-y-1/2 hover:scale-105 md:flex";
  const arrowStyle = {
    background: "var(--color-fg-paper)",
    borderColor: "var(--color-fg-line-soft)",
    color: "var(--primary)",
  } as const;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={updateArrows}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        onFocus={() => {
          focusRef.current = true;
        }}
        onBlur={() => {
          focusRef.current = false;
        }}
        className={`flex gap-4 overflow-x-auto pb-3 select-none md:cursor-grab md:active:cursor-grabbing [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden ${edgeClassName}`}
      >
        {track.map(({ it, r }) => renderItem(it, `${it.id}-${r}`))}
      </div>
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          aria-label="이전 팀 보기"
          className={`left-0 ${arrowBtn}`}
          style={arrowStyle}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          aria-label="다음 팀 보기"
          className={`right-0 ${arrowBtn}`}
          style={arrowStyle}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
