"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/live", label: "라이브" },
  { href: "/tournaments", label: "대회" },
  { href: "/standings", label: "순위" },
  { href: "/players", label: "FA선수" },
  { href: "/teams", label: "팀" },
  { href: "/notices", label: "공지사항" },
  { href: "/board", label: "자유게시판" },
];

export function SiteFooter() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{
        background: "var(--color-fg-paper)",
        borderTop: "1px solid var(--color-fg-line-soft)",
      }}
    >
      {/* blue ticker ribbon */}
      <div
        className="py-2 overflow-hidden"
        style={{ background: "var(--primary)" }}
      >
        <div
          className="flex whitespace-nowrap animate-ticker fg-display text-[13px] tracking-[0.12em]"
          style={{ color: "var(--primary-foreground)" }}
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center gap-6 px-6">
              {[
                "WHERE AMATEURS PLAY PRO",
                "LIVE SCORES · REAL STATS · GROUND CARDS",
                "SEASON 9 · WEEK 39/14",
                "PLAY YOUR GROWTH",
                "FAIRGROUND.KR",
              ].map((t, j) => (
                <span key={`${i}-${j}`} className="flex items-center gap-6">
                  <span>{t}</span>
                  <span
                    className="inline-block w-1.5 h-1.5 rotate-45"
                    style={{ background: "var(--primary-foreground)" }}
                  />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="relative py-16 px-5 md:px-10 fg-scanlines">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-10">
            {/* Brand block */}
            <div>
              <div
                role="img"
                aria-label="FairGround"
                style={{
                  width: 220,
                  height: 42,
                  background: "var(--primary)",
                  WebkitMaskImage: "url(/images/logo-horizontal.png)",
                  WebkitMaskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                  WebkitMaskPosition: "left center",
                  maskImage: "url(/images/logo-horizontal.png)",
                  maskRepeat: "no-repeat",
                  maskSize: "contain",
                  maskPosition: "left center",
                }}
              />
              <div
                className="fg-label mt-3"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                AMATEUR FUTSAL · EST. SEOUL
              </div>
              <p
                className="mt-6 fg-display text-[32px] tracking-[0.02em] max-w-[520px] leading-[0.95]"
                style={{ color: "var(--color-fg-ink)" }}
              >
                WHERE AMATEURS{" "}
                <span style={{ color: "var(--primary)" }}>PLAY PRO.</span>
              </p>
              <p
                className="mt-4 text-[13px] leading-relaxed max-w-[480px]"
                style={{
                  color: "var(--color-fg-ink-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                모두가 승리하는 그라운드. 실시간 스코어·개인 스탯·선수 카드로 모든 경기가 기록됩니다.
              </p>
            </div>

            {/* Nav */}
            <div className="grid grid-cols-2 gap-x-10 gap-y-3 shrink-0">
              {FOOTER_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-4 text-sm transition-colors"
                  style={{
                    color: "var(--color-fg-ink-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span className="transition-colors group-hover:text-[color:var(--primary)]">
                    {item.label}
                  </span>
                  <span className="fg-label text-[9px] opacity-40 transition group-hover:opacity-100 group-hover:text-[color:var(--primary)]">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div
            className="mt-14 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            style={{ borderTop: "1px solid var(--color-fg-line-soft)" }}
          >
            <span
              className="fg-mono text-[11px]"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              © 2026 FAIRGROUND · ALL RIGHTS RESERVED
            </span>
            <div
              className="flex items-center gap-6 fg-label"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              <span>FUTSAL LEAGUE PLATFORM</span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block w-[6px] h-[6px] rounded-full animate-pulse-dot"
                  style={{ background: "var(--primary)" }}
                />
                SYSTEM ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
