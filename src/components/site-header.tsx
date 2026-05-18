"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, User, LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const NAV_ITEMS = [
  { href: "/about", label: "소개" },
  { href: "/live", label: "라이브" },
  { href: "/tournaments", label: "대회" },
  { href: "/standings", label: "순위" },
  { href: "/players", label: "FA선수" },
  { href: "/teams", label: "팀" },
  { href: "/notices", label: "공지사항" },
  { href: "/board", label: "자유게시판" },
];

function FGMark() {
  return (
    <div
      role="img"
      aria-label="FairGround"
      style={{
        width: 150,
        height: 28,
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
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, player, initialized } = useAuthStore();

  // Glass header elevation: subtle at the top, lifts on scroll.
  // Static transition is acceptable under reduced-motion (no animation loop).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className="fg-glass-header fixed top-0 left-0 w-full z-50 h-[60px] flex items-center px-5 md:px-10 gap-8"
      style={{
        background: scrolled
          ? "rgba(255, 255, 255, 0.85)"
          : "rgba(255, 255, 255, 0.72)",
        borderBottom: scrolled
          ? "1px solid rgba(13, 27, 42, 0.10)"
          : "1px solid rgba(13, 27, 42, 0.06)",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
        transition:
          "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
      }}
    >
      {/* Logo */}
      <Link href="/" className="shrink-0 flex items-center mr-2" aria-label="FairGround 홈">
        <FGMark />
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-3 py-2 text-[13px] font-medium transition-colors duration-200 rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                fontFamily: "var(--font-body)",
                color: isActive
                  ? "var(--primary)"
                  : "var(--color-fg-blue)",
                letterSpacing: "0.01em",
                outlineColor: "var(--color-ring)",
              }}
              onMouseEnter={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--color-fg-blue-deep)";
              }}
              onMouseLeave={(e) => {
                if (!isActive)
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--color-fg-blue)";
              }}
            >
              {item.label}
              {isActive && (
                <span
                  className="absolute left-3 right-3 -bottom-[1px] h-[2px]"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right: LIVE indicator + auth */}
      <div className="hidden md:flex items-center gap-3 ml-auto">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 border"
          style={{
            borderColor: "var(--border)",
            background: "var(--secondary)",
          }}
        >
          <span
            className="h-[6px] w-[6px] rounded-full animate-pulse-dot"
            style={{
              background: "var(--destructive)",
              boxShadow: "0 0 8px var(--destructive)",
            }}
          />
          <span
            className="fg-label text-[10px]"
            style={{ color: "var(--foreground)" }}
          >
            LIVE
          </span>
        </div>

        {initialized &&
          (user ? (
            <Link
              href="/my"
              className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors border"
              style={{
                fontFamily: "var(--font-body)",
                color: pathname.startsWith("/my")
                  ? "var(--primary-foreground)"
                  : "var(--foreground)",
                background: pathname.startsWith("/my")
                  ? "var(--primary)"
                  : "transparent",
                borderColor: pathname.startsWith("/my")
                  ? "var(--primary)"
                  : "var(--border)",
              }}
            >
              <div
                className="h-6 w-6 grid place-items-center text-[10px] font-bold overflow-hidden"
                style={{
                  background: "var(--background)",
                  color: "var(--primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {(player?.profilePhotoUrl || player?.photoUrl) ? (
                  <img src={player.profilePhotoUrl || player.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3 w-3" />
                )}
              </div>
              <span className="fg-display tracking-wider text-[13px]">
                {player?.name || "MY"}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 transition-all fg-display tracking-[0.08em]"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <LogIn className="h-3.5 w-3.5" />
              참가 신청
            </Link>
          ))}
      </div>

      {/* Mobile menu toggle */}
      <button
        className="ml-auto md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="메뉴"
        style={{ color: "var(--foreground)" }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile nav */}
      {open && (
        <div
          className="fg-glass-header absolute top-[60px] left-0 w-full md:hidden flex flex-col py-4 px-5 gap-1"
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            borderBottom: "1px solid rgba(13, 27, 42, 0.10)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between px-3 py-3 border-l-2 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  fontFamily: "var(--font-body)",
                  color: isActive
                    ? "var(--primary)"
                    : "var(--color-fg-blue)",
                  borderColor: isActive ? "var(--primary)" : "transparent",
                  outlineColor: "var(--color-ring)",
                  background: isActive
                    ? "var(--color-fg-paper-3)"
                    : "transparent",
                }}
                onClick={() => setOpen(false)}
              >
                <span>{item.label}</span>
                <span
                  className="fg-label"
                  style={{
                    color: isActive
                      ? "var(--primary)"
                      : "var(--color-fg-ink-ghost)",
                  }}
                >
                  →
                </span>
              </Link>
            );
          })}
          <div
            className="mt-3 pt-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {user ? (
              <Link
                href="/my"
                className="flex items-center gap-2 px-3 py-3 text-base font-medium"
                style={{ color: "var(--primary)" }}
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4" />
                {player?.name || "마이페이지"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 px-3 py-3 fg-display text-base tracking-[0.08em]"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
                onClick={() => setOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                참가 신청
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
