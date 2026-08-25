"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  ChevronDown,
  LogOut,
  Menu,
  Pencil,
  Search,
  Shield,
  User,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAdminEntryLabel, isAdminLikeRole } from "@/lib/admin-access";
import { GlobalBackButton } from "@/components/global-back-button";
import { NotificationBell } from "@/components/notification-bell";
import { PushOptInButton } from "@/components/push-opt-in-button";
import { SearchModal } from "@/components/search-modal";

// 내비 구성 원칙
//  - "대회" 를 맨 앞에: 지금 사이트의 목표는 10/3 혼성 풋살 대회 한 건이다.
//  - 글 성격 페이지 3개(공지사항·피드·자유게시판)는 "커뮤니티" 그룹으로 접는다.
//    기능은 하나도 줄이지 않고, 데스크탑은 드롭다운 · 모바일은 서브메뉴로 전부 도달한다.
//  - "소개" 는 유지하되 맨 뒤로: 재방문자에게 우선순위가 가장 낮다.
type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: readonly NavLink[] };
type NavEntry = NavLink | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const NAV_ITEMS: readonly NavEntry[] = [
  { href: "/tournaments", label: "대회" },
  { href: "/live", label: "라이브" },
  { href: "/leaderboard", label: "랭킹" },
  { href: "/players", label: "FA선수" },
  { href: "/teams", label: "팀" },
  {
    label: "커뮤니티",
    items: [
      { href: "/notices", label: "공지사항" },
      { href: "/feed", label: "피드" },
      { href: "/board", label: "자유게시판" },
    ],
  },
  { href: "/about", label: "소개" },
];

function FGMark() {
  // 모바일에서 헤더(h=60px) 대비 로고(28px) 위아래 16px 여백이 시각상 과해 보임.
  // 모바일은 38px(여백 11px), 데스크탑은 28px(여백 16px) 로 분기해 컴팩트하게.
  return (
    <div
      role="img"
      aria-label="FairGround"
      className="h-[38px] w-[170px] md:h-[28px] md:w-[150px]"
      style={{
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
  const router = useRouter();
  const { user, player, logout } = useAuth();
  const showAdminEntry = isAdminLikeRole(player?.role);
  const accountHref = showAdminEntry ? "/admin" : user ? "/my" : "/login";
  const accountLabel = showAdminEntry ? getAdminEntryLabel(player?.role) : user ? "마이페이지" : "로그인";
  const playerActionHref = !user
    ? "/login?returnTo=/my/player-setup"
    : player
      ? "/my/card-edit"
      : "/my/player-setup";
  const playerActionLabel = player ? "카드수정" : "선수등록";
  const PlayerActionIcon = player ? Pencil : UserPlus;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false);
  const communityMenuRef = useRef<HTMLDivElement>(null);
  // null = 사용자가 아직 직접 접거나 편 적 없음 → 현재 위치를 따라 자동 결정.
  const [mobileCommunityToggled, setMobileCommunityToggled] = useState<boolean | null>(null);
  const isNavEntryActive = (entry: NavEntry) =>
    isNavGroup(entry)
      ? entry.items.some((item) => pathname.startsWith(item.href))
      : pathname.startsWith(entry.href);
  const accountMenuItems: Array<{ href: string; label: string; icon: LucideIcon }> = user
    ? [
        { href: "/my", label: "마이페이지", icon: User },
        { href: playerActionHref, label: playerActionLabel, icon: PlayerActionIcon },
        ...(player ? [{ href: "/my/badges", label: "내 배지", icon: Award }] : []),
        { href: "/my/team", label: player?.teamId ? "내 팀" : "팀 등록/가입", icon: Users },
        ...(showAdminEntry ? [{ href: "/admin", label: getAdminEntryLabel(player?.role), icon: Shield }] : []),
      ]
    : [];
  const accountName =
    player?.name || user?.email?.split("@")[0] || (showAdminEntry ? getAdminEntryLabel(player?.role) : "내 계정");

  // Glass header elevation: subtle at the top, lifts on scroll.
  // Static transition is acceptable under reduced-motion (no animation loop).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (accountMenuRef.current?.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  // 커뮤니티 드롭다운 — 계정 메뉴와 동일한 규칙(바깥 클릭 / ESC 로 닫힘).
  useEffect(() => {
    if (!communityMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (communityMenuRef.current?.contains(event.target as Node)) return;
      setCommunityMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCommunityMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [communityMenuOpen]);

  // 모바일 서브메뉴 기본값: 지금 보고 있는 페이지가 커뮤니티 안이면 펼친 채로
  // 시작해 내 위치를 메뉴에서 바로 확인할 수 있게 한다. 사용자가 한 번이라도
  // 직접 접거나 펴면 그 선택이 우선한다(메뉴를 다시 열면 기본값으로 복귀).
  const communityActive = NAV_ITEMS.filter(isNavGroup).some((group) =>
    group.items.some((item) => pathname.startsWith(item.href)),
  );
  const mobileCommunityOpen = mobileCommunityToggled ?? communityActive;

  const toggleMobileMenu = () => {
    const next = !open;
    setOpen(next);
    if (next) setMobileCommunityToggled(null);
  };

  // Cmd/Ctrl + K → open search (when closed). ESC handling lives inside SearchModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        if (!searchOpen) {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    setOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      // 모바일 메뉴(open)가 열리면 backdrop-blur 글래스를 끄고 솔리드 배경으로
      // 전환 — 메뉴와 헤더가 한 덩어리 솔리드 패널처럼 보이게(뒤 비침 제거).
      className={`${open ? "" : "fg-glass-header"} fixed top-0 left-0 w-full z-50 h-[60px] flex items-center px-5 md:px-10 gap-3 md:gap-6 xl:gap-8`}
      style={{
        background: open
          ? "var(--color-fg-paper, #ffffff)"
          : scrolled
            ? "rgba(255, 255, 255, 0.85)"
            : "rgba(255, 255, 255, 0.72)",
        borderBottom: scrolled || open
          ? "1px solid rgba(13, 27, 42, 0.10)"
          : "1px solid rgba(13, 27, 42, 0.06)",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
        transition:
          "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
      }}
    >
      <GlobalBackButton />

      {/* Logo */}
      <Link href="/" className="shrink-0 flex items-center mr-2" aria-label="FairGround 홈">
        <FGMark />
      </Link>

      {/* Desktop nav */}
      <nav className="hidden xl:flex items-center gap-1 flex-1">
        {NAV_ITEMS.map((entry) => {
          const isActive = isNavEntryActive(entry);

          if (isNavGroup(entry)) {
            return (
              <div key={entry.label} ref={communityMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={communityMenuOpen}
                  onClick={() => setCommunityMenuOpen((current) => !current)}
                  className="relative flex items-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors duration-200 rounded-[var(--radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    fontFamily: "var(--font-body)",
                    color: isActive ? "var(--primary)" : "var(--color-fg-blue)",
                    letterSpacing: "0.01em",
                    outlineColor: "var(--color-ring)",
                  }}
                >
                  {entry.label}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${communityMenuOpen ? "rotate-180" : ""}`}
                  />
                  {isActive && (
                    <span
                      className="absolute left-3 right-3 -bottom-[1px] h-[2px]"
                      style={{ background: "var(--primary)" }}
                    />
                  )}
                </button>

                {communityMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-[calc(100%+10px)] z-50 w-[180px] overflow-hidden rounded-[var(--radius-md)] border shadow-xl"
                    style={{
                      background: "var(--color-fg-paper, #ffffff)",
                      borderColor: "rgba(0,71,171,0.16)",
                      boxShadow: "0 22px 50px rgba(13, 27, 42, 0.16)",
                    }}
                  >
                    {entry.items.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          role="menuitem"
                          className="flex min-h-[44px] items-center px-3 text-[13px] font-bold transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                          style={{
                            color: childActive
                              ? "var(--primary)"
                              : "var(--color-fg-ink)",
                            background: childActive
                              ? "var(--color-fg-paper-3)"
                              : "transparent",
                          }}
                          onClick={() => setCommunityMenuOpen(false)}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const item = entry;
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
      <div className="hidden xl:flex items-center gap-3 ml-auto">
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

        <button
          type="button"
          aria-label="검색 열기"
          onClick={() => setSearchOpen(true)}
          className="relative flex h-10 items-center gap-1.5 rounded-md px-2 hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--color-ring)" }}
        >
          <Search width={20} height={20} style={{ color: "var(--color-fg-ink)" }} />
          <kbd
            className="hidden lg:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px]"
            style={{
              borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))",
              color: "var(--color-fg-ink-muted, #6B7280)",
            }}
            aria-hidden="true"
          >
            ⌘K
          </kbd>
        </button>

        <NotificationBell />
        <PushOptInButton />

        <Link
          href={playerActionHref}
          className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 transition-all fg-display tracking-[0.08em]"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          <PlayerActionIcon className="h-3.5 w-3.5" />
          {playerActionLabel}
        </Link>

        {user ? (
          <div ref={accountMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((current) => !current)}
              className="flex items-center gap-1.5 border px-4 py-2 text-[12px] font-bold transition-all fg-display tracking-[0.08em]"
              style={{
                background: "var(--foreground)",
                borderColor: "var(--foreground)",
                color: "var(--background)",
              }}
            >
              {showAdminEntry ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {accountLabel}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-[220px] overflow-hidden rounded-[var(--radius-md)] border shadow-xl"
                style={{
                  background: "var(--color-fg-paper, #ffffff)",
                  borderColor: "rgba(0,71,171,0.16)",
                  boxShadow: "0 22px 50px rgba(13, 27, 42, 0.16)",
                }}
              >
                <div
                  className="px-3 py-2.5"
                  style={{ borderBottom: "1px solid rgba(13, 27, 42, 0.08)" }}
                >
                  <div className="fg-mono text-[9px]" style={{ color: "var(--primary)" }}>
                    ACCOUNT
                  </div>
                  <div className="truncate text-[13px] font-black" style={{ color: "var(--foreground)" }}>
                    {accountName}
                  </div>
                </div>

                <div className="py-1">
                  {accountMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        role="menuitem"
                        className="flex min-h-[42px] items-center gap-2 px-3 text-[13px] font-bold transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                        style={{ color: "var(--color-fg-ink)" }}
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex min-h-[42px] w-full items-center gap-2 px-3 text-left text-[13px] font-bold transition-colors hover:bg-[rgba(255,59,48,0.08)]"
                  style={{
                    borderTop: "1px solid rgba(13, 27, 42, 0.08)",
                    color: "var(--destructive)",
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href={accountHref}
            className="flex items-center gap-1.5 border px-4 py-2 text-[12px] font-bold transition-all fg-display tracking-[0.08em]"
            style={{
              background: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--primary)",
            }}
          >
            <User className="h-3.5 w-3.5" />
            {accountLabel}
          </Link>
        )}
      </div>

      {/* Mobile search button */}
      <button
        type="button"
        aria-label="검색 열기"
        onClick={() => setSearchOpen(true)}
        className="ml-auto flex h-10 w-10 items-center justify-center xl:hidden"
        style={{ color: "var(--foreground)" }}
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Mobile menu toggle */}
      <button
        className="xl:hidden"
        onClick={toggleMobileMenu}
        aria-label="메뉴"
        style={{ color: "var(--foreground)" }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile nav backdrop — 메뉴 아래 영역을 어둡게 덮어 뒤 페이지를 가리고,
          탭하면 메뉴를 닫는다. 헤더(z-50) 아래, 페이지 위. */}
      {open && (
        <div
          className="fixed inset-0 top-[60px] z-40 xl:hidden"
          style={{ background: "rgba(13, 27, 42, 0.45)" }}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile nav */}
      {open && (
        <div
          // 커뮤니티 서브메뉴를 펼치고 로그인 상태까지 겹치면 메뉴가 화면보다
          // 길어질 수 있다. 패널 자체를 스크롤시켜 항목이 화면 밖으로 잘려
          // 도달 불가능해지는 상황을 막는다.
          className="absolute top-[60px] left-0 w-full xl:hidden flex flex-col py-4 px-5 gap-1 z-50 max-h-[calc(100dvh-60px)] overflow-y-auto overscroll-contain"
          style={{
            // 불투명 배경 — 이전 0.85 alpha + backdrop-blur 로는 뒤 페이지(랭킹
            // 리스트 등)가 비쳐 가독성이 떨어졌다. 솔리드 배경으로 차단.
            background: "var(--color-fg-paper, #ffffff)",
            borderBottom: "1px solid rgba(13, 27, 42, 0.10)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {NAV_ITEMS.map((entry) => {
            const isActive = isNavEntryActive(entry);

            if (isNavGroup(entry)) {
              return (
                <div key={entry.label}>
                  <button
                    type="button"
                    aria-expanded={mobileCommunityOpen}
                    aria-controls="mobile-community-submenu"
                    onClick={() => setMobileCommunityToggled(!mobileCommunityOpen)}
                    className="flex w-full items-center justify-between px-3 py-3 border-l-2 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: isActive ? "var(--primary)" : "var(--color-fg-blue)",
                      borderColor: isActive ? "var(--primary)" : "transparent",
                      outlineColor: "var(--color-ring)",
                      background: isActive
                        ? "var(--color-fg-paper-3)"
                        : "transparent",
                    }}
                  >
                    <span>{entry.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mobileCommunityOpen ? "rotate-180" : ""}`}
                      style={{
                        color: isActive
                          ? "var(--primary)"
                          : "var(--color-fg-ink-ghost)",
                      }}
                    />
                  </button>

                  {mobileCommunityOpen && (
                    <div
                      id="mobile-community-submenu"
                      className="flex flex-col gap-1 py-1 pl-4"
                    >
                      {entry.items.map((child) => {
                        const childActive = pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="flex items-center justify-between px-3 py-3 border-l-2 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            style={{
                              fontFamily: "var(--font-body)",
                              color: childActive
                                ? "var(--primary)"
                                : "var(--color-fg-blue)",
                              borderColor: childActive
                                ? "var(--primary)"
                                : "var(--color-fg-line-soft)",
                              outlineColor: "var(--color-ring)",
                              background: childActive
                                ? "var(--color-fg-paper-3)"
                                : "transparent",
                            }}
                            onClick={() => setOpen(false)}
                          >
                            <span>{child.label}</span>
                            <span
                              className="fg-label"
                              style={{
                                color: childActive
                                  ? "var(--primary)"
                                  : "var(--color-fg-ink-ghost)",
                              }}
                            >
                              →
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const item = entry;
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
              href={playerActionHref}
              className="flex items-center justify-center gap-2 px-3 py-3 fg-display text-base tracking-[0.08em]"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
              onClick={() => setOpen(false)}
            >
              <PlayerActionIcon className="h-4 w-4" />
              {playerActionLabel}
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
            {user && (
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-2 border px-3 py-3 fg-display text-base tracking-[0.08em]"
                style={{
                  background: "rgba(255,59,48,0.08)",
                  borderColor: "rgba(255,59,48,0.22)",
                  color: "var(--destructive)",
                }}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            )}
          </div>
        </div>
      )}

      {/* Global search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
