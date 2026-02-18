"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, User, LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

const NAV_ITEMS = [
  { href: "/live", label: "라이브" },
  { href: "/tournaments", label: "대회" },
  { href: "/standings", label: "순위" },
  { href: "/players", label: "FA선수" },
  { href: "/teams", label: "팀" },
  { href: "/notices", label: "공지사항" },
  { href: "/board", label: "자유게시판" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user, player, initialized } = useAuthStore();

  return (
    <header
      className="fixed top-0 left-0 w-full z-50 h-[60px] flex items-center px-6 md:px-10 gap-8"
      style={{
        background: "rgba(13, 27, 42, 0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0, 200, 83, 0.2)",
      }}
    >
      {/* Logo */}
      <Link href="/" className="shrink-0 flex items-center mr-4">
        <img
          src="/images/logo-horizontal.png"
          alt="FairGround"
          style={{ height: 28, width: "auto" }}
        />
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-6 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium tracking-[0.5px] transition-colors"
              style={{
                fontFamily: "var(--font-noto)",
                color: isActive ? "#69F0AE" : "#D9E2EC",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#69F0AE"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "#D9E2EC"; }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side: Live indicator + auth */}
      <div className="hidden md:flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-fg-green animate-pulse-dot" />
          <span
            className="text-[11px] tracking-[2px] uppercase text-fg-gray-500"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Live
          </span>
        </div>

        {initialized && (
          user ? (
            <Link
              href="/my"
              className="flex items-center gap-2 text-[13px] font-medium transition-colors"
              style={{ color: pathname.startsWith("/my") ? "#69F0AE" : "#D9E2EC" }}
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                style={{ background: "rgba(0, 200, 83, 0.15)", border: "1px solid rgba(0, 200, 83, 0.4)", color: "#69F0AE" }}
              >
                {(player?.profilePhotoUrl || player?.photoUrl) ? (
                  <img src={player.profilePhotoUrl || player.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
              {player?.name || "마이"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md transition-all"
              style={{
                background: "rgba(0, 200, 83, 0.1)",
                border: "1px solid rgba(0, 200, 83, 0.3)",
                color: "#69F0AE",
              }}
            >
              <LogIn className="h-3.5 w-3.5" />
              로그인
            </Link>
          )
        )}
      </div>

      {/* Mobile menu toggle */}
      <button
        className="ml-auto md:hidden text-fg-gray-200"
        onClick={() => setOpen(!open)}
        aria-label="메뉴"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile nav */}
      {open && (
        <div
          className="absolute top-[60px] left-0 w-full md:hidden flex flex-col py-4 px-6 gap-4"
          style={{
            background: "rgba(13, 27, 42, 0.98)",
            borderBottom: "1px solid rgba(0, 200, 83, 0.2)",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-base font-medium text-fg-gray-200"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-3">
            {user ? (
              <Link
                href="/my"
                className="flex items-center gap-2 text-base font-medium"
                style={{ color: "#69F0AE" }}
                onClick={() => setOpen(false)}
              >
                <User className="h-4 w-4" />
                {player?.name || "마이페이지"}
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-base font-medium"
                style={{ color: "#69F0AE" }}
                onClick={() => setOpen(false)}
              >
                <LogIn className="h-4 w-4" />
                로그인 / 회원가입
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
