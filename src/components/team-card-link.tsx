"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TeamGalleryItem } from "@/components/team-circular-gallery";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";
import { getTeamCardAppearance, TEAM_CARD_ASPECT_RATIO, TEAM_CARD_TIER_ORDER } from "@/lib/team-card-appearance";

/** 홈과 팀 목록이 같은 링크·카드 렌더링을 사용한다. 드래그 판정은 TeamMarquee가 맡는다. */
export function TeamCardLink({ item, width = 200 }: { item: TeamGalleryItem; width?: number }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const appearance = getTeamCardAppearance(item.tier ?? TEAM_CARD_TIER_ORDER[item.colorIndex]);

  useEffect(() => {
    let cancelled = false;
    // 화면 크기의 캔버스를 직접 표시해 PNG 인코딩과 대형 이미지 복제를 피한다.
    void createTeamCardCanvas(item, { width: 540 })
      .then((canvas) => {
        const holder = holderRef.current;
        if (cancelled || !holder) return;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${item.name} ${appearance.label} 팀 카드`);
        canvas.style.cssText = "display:block;width:100%;height:100%;border-radius:14px";
        holder.replaceChildren(canvas);
        setReady(true);
      })
      .catch((error) => console.error("[TeamCardLink] canvas failed:", error));
    return () => { cancelled = true; };
  }, [item, appearance.label]);

  return (
    <Link
      href={`/teams/${item.id}`}
      aria-label={`${item.name} ${appearance.label} 카드 · 팀 페이지로 이동`}
      draggable={false}
      className="shrink-0 snap-center rounded-[14px] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
      style={{ width }}
    >
      <div className="relative w-full" style={{ aspectRatio: TEAM_CARD_ASPECT_RATIO }}>
        <div ref={holderRef} className="absolute inset-0" style={{ opacity: ready ? 1 : 0 }} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[14px] p-4 text-center text-sm font-bold"
            style={{ background: "var(--color-fg-paper-2)", color: "var(--color-fg-ink)" }}>
            {item.name}
          </div>
        )}
      </div>
    </Link>
  );
}
