"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MIXED_FUTSAL_CARD_NEWS } from "@/lib/mixed-futsal-assets";

const LAST_SLIDE_INDEX = MIXED_FUTSAL_CARD_NEWS.length - 1;

export function MixedFutsalCardNews() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = MIXED_FUTSAL_CARD_NEWS[activeIndex];

  const move = useCallback((direction: -1 | 1) => {
    setActiveIndex((current) => {
      if (direction === -1) return current === 0 ? LAST_SLIDE_INDEX : current - 1;
      return current === LAST_SLIDE_INDEX ? 0 : current + 1;
    });
  }, []);

  return (
    <section
      className="border-b border-[#D0D8E8] bg-[#EEF3FF] px-5 py-12 sm:px-8 sm:py-16 md:px-10 md:py-20"
      aria-labelledby="mixed-futsal-card-news-title"
    >
      <div className="mx-auto grid max-w-[1180px] gap-8 lg:grid-cols-[minmax(260px,0.72fr)_minmax(360px,1fr)] lg:items-center lg:gap-14">
        <div>
          <p className="fg-label text-[11px] text-[#0047AB]">TOURNAMENT GUIDE</p>
          <h2
            id="mixed-futsal-card-news-title"
            className="mt-3 text-[28px] font-black leading-[1.16] text-[#0D1B2A] sm:text-[42px]"
          >
            이미지로 먼저 보는
            <br />
            페어그라운드 대회
          </h2>

          <div className="mt-7 min-h-[128px] border-l-2 border-[#0047AB] pl-5" aria-live="polite">
            <p className="fg-mono text-[11px] text-[#0047AB]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(MIXED_FUTSAL_CARD_NEWS.length).padStart(2, "0")}
            </p>
            <h3 className="mt-3 text-[20px] font-black leading-[1.32] text-[#0D1B2A] sm:text-[24px]">
              {activeSlide.title}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.7] text-[#526277] sm:text-[15px]">
              {activeSlide.description}
            </p>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="이전 대회 안내 이미지"
              className="inline-flex h-12 w-12 items-center justify-center border border-[#AFC1E5] bg-white text-[#0047AB] transition hover:border-[#0047AB] hover:bg-[#F5F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="다음 대회 안내 이미지"
              className="inline-flex h-12 w-12 items-center justify-center bg-[#0047AB] text-white transition hover:bg-[#003080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]"
            >
              <ArrowRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-2" aria-label="대회 안내 이미지 선택">
            {MIXED_FUTSAL_CARD_NEWS.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${index + 1}번 이미지: ${slide.label}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className="h-1.5 w-9 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0047AB]"
                style={{ background: index === activeIndex ? "#0047AB" : "#AFC1E5" }}
              />
            ))}
          </div>
        </div>

        <figure className="mx-auto w-full max-w-[560px]">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0D1B2A] shadow-[0_24px_55px_rgba(13,27,42,0.18)]">
            <Image
              key={activeSlide.src}
              src={activeSlide.src}
              alt={`${activeSlide.label}: ${activeSlide.title}`}
              fill
              sizes="(max-width: 1023px) min(92vw, 560px), 50vw"
              className="object-contain"
              priority={activeIndex === 0}
            />
          </div>
          <figcaption className="mt-3 flex items-center justify-between gap-4 text-[12px] font-bold text-[#526277]">
            <span>{activeSlide.label}</span>
            <span className="fg-mono">FAIRGROUND · 2026</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
