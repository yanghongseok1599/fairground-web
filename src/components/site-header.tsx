"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Shield, X, User, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAdminEntryLabel, isAdminLikeRole } from "@/lib/admin-access";
import { NotificationBell } from "@/components/notification-bell";

const NAV_ITEMS = [
  { href: "/about", label: "소개" },
  { href: "/live", label: "라이브" },
  { href: "/tournaments", label: "대회" },
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
  const { user, player } = useAuth();
  const showAdminEntry = isAdminLikeRole(player?.role);
  const accountHref = showAdminEntry ? "/admin" : user ? "/my" : "/login";
  const accountLabel = showAdminEntry ? getAdminEntryLabel(player?.role) : user ? "마이페이지" : "로그인";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

        <NotificationBell />

        <Link
          href="/my/player-setup"
          className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 transition-all fg-display tracking-[0.08em]"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          <UserPlus className="h-3.5 w-3.5" />
          선수등록
        </Link>

        <Link
          href={accountHref}
          className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 border transition-all fg-display tracking-[0.08em]"
          style={{
            background: user ? "var(--foreground)" : "var(--background)",
            borderColor: user ? "var(--foreground)" : "var(--border)",
            color: user ? "var(--background)" : "var(--primary)",
          }}
        >
          {showAdminEntry ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          {accountLabel}
        </Link>
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
            <Link
              href="/my/player-setup"
              className="flex items-center justify-center gap-2 px-3 py-3 fg-display text-base tracking-[0.08em]"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
              onClick={() => setOpen(false)}
            >
              <UserPlus className="h-4 w-4" />
              선수등록
            </Link>
            <Link
              href={accountHref}
              className="mt-2 flex items-center justify-center gap-2 px-3 py-3 fg-display text-base tracking-[0.08em] border"
              style={{
                background: user ? "var(--foreground)" : "var(--background)",
                borderColor: user ? "var(--foreground)" : "var(--border)",
                color: user ? "var(--background)" : "var(--primary)",
              }}
              onClick={() => setOpen(false)}
            >
              {showAdminEntry ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
