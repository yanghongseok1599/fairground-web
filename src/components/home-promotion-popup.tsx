"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Gauge, MapPin, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchActiveSitePopup, type SitePopup } from "@/lib/site-popups";
import {
  isMixedFutsalPromotion,
  MIXED_FUTSAL_COVER_IMAGE_PATH,
} from "@/lib/mixed-futsal-assets";

/* 팝업 표면은 거의 검정(#05070a). 브랜드키트에 레드가 없으므로 강조는 전부
 * 블루 계열로 처리한다. 다크 위 대비(WCAG AA) 기준 실측값:
 *   Sky Tint  #D6E4FF (var(--color-fg-blue-soft)) on #05070a → 15.7:1  (아이콘/배지/포커스 링)
 *   Royal     #0047AB (var(--primary))            + #ffffff → 8.4:1   (CTA 배경 위 흰 글자)
 *   Mid Blue  #1A5CC4                             + #ffffff → 6.2:1   (CTA hover / 체크박스 accent)
 *   Deep Blue #003080 (var(--color-fg-blue-deep))           → 포스터 패널 글로우
 * Royal/Deep 는 다크 위 텍스트로 쓰면 2.4:1 / 1.7:1 이라 배경으로만 사용. */
const ACCENT_SOFT = "text-[var(--color-fg-blue-soft)]";
/* 포커스 링. globals.css 의 base 레이어가 모든 요소에 ring/50(=#0047AB 50%)
 * 을 깔아두는데 이 값은 팝업의 near-black 표면에서 1.6:1 로 사실상 보이지
 * 않는다. 그래서 Sky Tint(15.7:1)로 덮어쓴다. outline 임의값은 폭과 색이
 * 같은 네임스페이스를 쓰므로 color 타입 힌트로 해석을 못박아 둔다. */
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-fg-blue-soft)]";

/* 팝업 셸과 포스터 프레임이 공유하는 크기 규칙.
 * 프레임은 "높이 지정 → aspect-ratio 4/5 → 너비 자동" 순으로 계산되므로,
 * 세로 예산만 정하면 포스터가 절대 잘리지 않는다.
 *   1열(<640px): 뷰포트 높이의 36%(최대 280px). 본문·CTA 세로 공간 확보용.
 *   2열(≥640px): 아래 세 값의 min —
 *     636px                                   상한(초대형 화면에서 과대 확대 방지)
 *     calc(100svh-8rem)                       팝업 세로 예산(짧은 화면 대응)
 *     calc(min(1120px,100vw-2rem)*0.55)       팝업 실제 폭의 44%를 포스터 폭으로
 *                                             (폭×1.25=높이 → 0.44*1.25=0.55)
 *   → 세로가 짧아도 가로가 좁아도 알아서 작아지므로 팝업이 화면을 넘지 않는다.
 * 다른 비율 이미지가 들어와도 프레임은 4:5 를 유지하고 object-contain 이
 * 레터박스로 처리하므로 어떤 경우에도 크롭이 발생하지 않는다. */
const SHELL_MAX_H = "max-h-[min(820px,calc(100svh-2rem))]";
const POSTER_FRAME =
  "aspect-[4/5] h-[min(36svh,280px)] w-auto max-w-full sm:h-[min(636px,calc(100svh-8rem),calc(min(1120px,100vw-2rem)*0.55))]";

function readStorage(storage: Storage | undefined, key: string): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorage(storage: Storage | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

// Local calendar day stamp (YYYY-M-D). Comparing against this naturally
// expires the "오늘 다시 안보기" choice at local midnight.
function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function readDailyDismissed(storage: Storage | undefined, key: string): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(key) === todayStamp();
  } catch {
    return false;
  }
}

function writeDailyDismissed(storage: Storage | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, todayStamp());
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

export function HomePromotionPopup() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [popup, setPopup] = useState<SitePopup | null>(null);
  const [dismissToday, setDismissToday] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    // Admin preview: bypass the dismissal storage so operators always see the
    // currently active popup.
    const forcePreview =
      params.get("promoPreview") === "1" || params.get("promo") === "preview";

    let cancelled = false;
    let timer: number | null = null;

    void fetchActiveSitePopup("home").then((nextPopup) => {
      if (cancelled || !nextPopup) return;

      const storageKey = popupDismissStorageKey(nextPopup);
      const sessionKey = popupSessionStorageKey(nextPopup);
      const dailyKey = popupDailyStorageKey(nextPopup);
      if (!forcePreview && readStorage(window.localStorage, storageKey)) return;
      if (!forcePreview && readDailyDismissed(window.localStorage, dailyKey)) return;
      if (!forcePreview && readStorage(window.sessionStorage, sessionKey)) return;

      timer = window.setTimeout(() => {
        if (cancelled) return;
        setPopup(nextPopup);
        setReady(true);
        setOpen(true);
      }, Math.max(0, Math.min(10000, nextPopup.displayDelayMs)));
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const closeForSession = () => {
    if (typeof window !== "undefined" && popup) {
      if (dismissToday) {
        // "오늘 다시 안보기": keep hidden until local midnight across reloads.
        writeDailyDismissed(window.localStorage, popupDailyStorageKey(popup));
      } else {
        writeStorage(window.sessionStorage, popupSessionStorageKey(popup));
      }
    }
    setOpen(false);
  };

  const dismissLongTerm = () => {
    if (typeof window !== "undefined" && popup) {
      writeStorage(window.localStorage, popupDismissStorageKey(popup));
    }
    setOpen(false);
  };

  if (!ready || !popup) return null;

  const [titleLineOne, titleLineTwo] = splitPopupTitle(popup.title);
  const primaryHref = popup.ctaHref;
  const primaryLabel = popup.ctaLabel;
  const secondaryHref = popup.secondaryHref;
  const secondaryLabel = popup.secondaryLabel;
  const visualImageUrl = isMixedFutsalPromotion(popup)
    ? MIXED_FUTSAL_COVER_IMAGE_PATH
    : popup.imageUrl;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeForSession();
        else setOpen(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={`${SHELL_MAX_H} overflow-hidden rounded-[var(--radius-lg)] border-0 bg-[#05070a] p-0 shadow-[0_28px_80px_rgba(5,7,10,0.54)] sm:max-w-[min(1120px,calc(100%-2rem))]`}
      >
        <DialogTitle className="sr-only">
          {popup.name} 홍보
        </DialogTitle>
        <DialogDescription className="sr-only">
          {popup.name} 소개 페이지로 이동할 수 있는 홍보 팝업입니다.
        </DialogDescription>

        {/* 셸. <640px: 포스터(고정) → 본문(스크롤) → CTA(고정) 세로 스택.
            ≥640px: 좌 포스터 / 우 본문 2열. 어느 쪽이든 CTA 는 스크롤 영역
            밖의 고정 푸터라 스크롤 없이 항상 도달 가능하다. */}
        <div className={`relative flex ${SHELL_MAX_H} flex-col overflow-hidden sm:flex-row`}>
          <button
            type="button"
            onClick={closeForSession}
            aria-label="홍보 팝업 닫기"
            className={`absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/36 bg-white/92 text-[#05070a] shadow-sm transition hover:bg-white ${FOCUS_RING}`}
          >
            <X className="h-4 w-4" />
          </button>

          {/* 포스터 컬럼 — 4:5 프레임 + object-contain 이라 크롭이 없다. */}
          <div className="relative flex shrink-0 items-center justify-center overflow-hidden border-b border-white/10 px-5 py-5 sm:shrink sm:border-b-0 sm:border-r lg:px-7 lg:py-7">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(125%_95%_at_50%_0%,rgba(0,48,128,0.55)_0%,rgba(5,7,10,0)_72%)]"
            />
            {visualImageUrl ? (
              <div
                className={`relative ${POSTER_FRAME} overflow-hidden rounded-[var(--radius-md)] bg-white/[0.03] shadow-[0_18px_48px_rgba(0,0,0,0.5)]`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={visualImageUrl}
                  alt={`${popup.name} 포스터`}
                  className="absolute inset-0 h-full w-full object-contain object-center"
                />
              </div>
            ) : (
              <div
                className={`relative flex ${POSTER_FRAME} items-center justify-center rounded-[var(--radius-md)] border border-dashed border-white/16 px-6 text-center text-sm font-semibold text-white/52`}
              >
                홍보 이미지가 등록되지 않았습니다
              </div>
            )}
          </div>

          {/* 본문 컬럼 — 스크롤 영역 + 고정 CTA 푸터 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:min-w-[280px] lg:min-w-[336px]">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-5 pt-6 text-white sm:px-7 sm:pt-12 lg:px-8">
              <div className="sm:my-auto">
                <div className="mb-4 inline-flex items-center gap-2 border border-[rgba(0,71,171,0.55)] bg-[rgba(0,71,171,0.18)] px-3 py-1.5 text-[10px] font-black tracking-[0.24em] text-[var(--color-fg-blue-soft)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-fg-blue-soft)]" />
                  {popup.eyebrow || "PROMOTION"}
                </div>

                <h2 className="text-[30px] font-black leading-[1.04] text-white sm:text-[32px] lg:text-[42px]">
                  {titleLineOne}
                  {titleLineTwo && (
                    <>
                      <br />
                      {titleLineTwo}
                    </>
                  )}
                </h2>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/72">
                  {popup.body}
                </p>

                <div className="mt-5 grid gap-3 text-sm text-white/78">
                  {popup.detailOne && (
                    <div className="flex items-center gap-3">
                      <MapPin className={`h-4 w-4 shrink-0 ${ACCENT_SOFT}`} />
                      <span>{popup.detailOne}</span>
                    </div>
                  )}
                  {popup.detailTwo && (
                    <div className="flex items-center gap-3">
                      <CalendarDays className={`h-4 w-4 shrink-0 ${ACCENT_SOFT}`} />
                      <span>{popup.detailTwo}</span>
                    </div>
                  )}
                  {popup.detailThree && (
                    <div className="flex items-center gap-3">
                      <Sparkles className={`h-4 w-4 shrink-0 ${ACCENT_SOFT}`} />
                      <span>{popup.detailThree}</span>
                    </div>
                  )}
                  {popup.detailFour && (
                    <div className="flex items-center gap-3">
                      <Gauge className={`h-4 w-4 shrink-0 ${ACCENT_SOFT}`} />
                      <span>{popup.detailFour}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="relative shrink-0 border-t border-white/10 px-6 pb-4 pt-4 sm:px-7 lg:px-8">
              {/* 스크롤이 필요한 화면(작은 폰)에서 본문이 경계선에 칼같이
                  잘려 보이지 않도록 위쪽으로 페이드를 겹친다. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-[linear-gradient(to_top,#05070a_0%,rgba(5,7,10,0)_100%)]"
              />
              <Link
                href={primaryHref}
                onClick={closeForSession}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 text-[15px] font-black text-white transition hover:bg-[#1A5CC4] ${FOCUS_RING}`}
              >
                {primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {secondaryLabel && secondaryHref && (
                <Link
                  href={secondaryHref}
                  onClick={closeForSession}
                  className={`mt-2 flex min-h-9 w-full items-center justify-center text-[13px] font-semibold text-white/64 transition hover:text-white ${FOCUS_RING}`}
                >
                  {secondaryLabel}
                </Link>
              )}
              <div className="mt-2 flex min-h-9 items-center justify-between gap-3">
                <label className="inline-flex min-h-9 cursor-pointer select-none items-center gap-2 text-[13px] font-semibold text-white/62 transition hover:text-white">
                  <input
                    type="checkbox"
                    checked={dismissToday}
                    onChange={(event) => setDismissToday(event.target.checked)}
                    className={`h-4 w-4 cursor-pointer rounded border border-white/45 bg-transparent accent-[#1A5CC4] ${FOCUS_RING}`}
                  />
                  오늘 다시 안보기
                </label>
                <button
                  type="button"
                  onClick={dismissLongTerm}
                  className={`min-h-9 text-[13px] font-semibold text-white/62 transition hover:text-white ${FOCUS_RING}`}
                >
                  다시 보지 않기
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function popupDismissStorageKey(popup: SitePopup): string {
  return `fairground:site-popup:${popup.id}:v${popup.dismissVersion}:dismissed`;
}

function popupSessionStorageKey(popup: SitePopup): string {
  return `fairground:site-popup:${popup.id}:v${popup.dismissVersion}:closed`;
}

function popupDailyStorageKey(popup: SitePopup): string {
  return `fairground:site-popup:${popup.id}:v${popup.dismissVersion}:daily`;
}

function splitPopupTitle(title: string): [string, string] {
  if (title.includes("|")) {
    const [first, ...rest] = title.split("|");
    return [first.trim(), rest.join(" ").trim()];
  }
  const parts = title.trim().split(/\s+/);
  if (parts.length <= 2) return [title, ""];
  const midpoint = Math.ceil(parts.length / 2);
  return [parts.slice(0, midpoint).join(" "), parts.slice(midpoint).join(" ")];
}
