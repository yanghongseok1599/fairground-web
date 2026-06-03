"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  LayoutDashboard,
  Users,
} from "lucide-react";

// Only the segments that need a director-only management surface. Public
// boards (notices/gallery/chat/club) decide their own edit affordances by
// role, so they no longer pull the admin sidebar.
const ADMIN_SEGMENTS = ["admin", "members", "dues"] as const;

type NavItem = {
  segment: (typeof ADMIN_SEGMENTS)[number];
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { segment: "admin", label: "팀 개요", icon: LayoutDashboard },
  { segment: "members", label: "멤버 관리", icon: Users },
  { segment: "dues", label: "회비", icon: CreditCard },
];

/**
 * Shell that gives every admin-area route under /teams/[id]/* a consistent
 * left-rail navigation. For non-admin routes (e.g. the public team home at
 * /teams/[id]) it renders children unchanged so server-rendered marketing
 * remains untouched.
 */
export function TeamAdminLayout({
  teamId,
  children,
}: {
  teamId: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = `/teams/${teamId}`;
  const activeSegment = ADMIN_SEGMENTS.find(
    (segment) =>
      pathname === `${base}/${segment}` ||
      pathname.startsWith(`${base}/${segment}/`),
  );

  if (!activeSegment) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-screen pt-[60px]"
      style={{ background: "var(--color-fg-paper)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[80px] lg:h-fit">
            <Link
              href={base}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold hover:opacity-70"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              <ArrowLeft className="h-4 w-4" />팀 홈
            </Link>

            <p
              className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[2px]"
              style={{
                color: "var(--primary)",
                fontFamily: "var(--font-space-mono)",
              }}
            >
              TEAM OPS
            </p>

            <nav
              aria-label="팀 관리 메뉴"
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "rgba(0,71,171,0.14)" }}
            >
              <ul className="flex flex-row overflow-x-auto lg:flex-col lg:overflow-visible">
                {NAV_ITEMS.map((item) => {
                  const active = activeSegment === item.segment;
                  const Icon = item.icon;
                  const className = [
                    "flex min-h-[48px] flex-1 items-center gap-3 px-4 text-sm font-bold transition-colors lg:flex-none",
                    "border-b border-transparent lg:border-b lg:border-r-0",
                    active
                      ? "bg-[rgba(0,71,171,0.08)] text-[var(--primary)] lg:border-l-2 lg:border-l-[var(--primary)]"
                      : "text-[var(--color-fg-ink)] hover:bg-[rgba(0,71,171,0.04)]",
                    item.disabled ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ");

                  const content = (
                    <span className="flex w-full items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex flex-col items-start leading-tight">
                        {item.label}
                        {item.disabled && (
                          <span className="text-[10px] font-normal opacity-70">
                            준비중
                          </span>
                        )}
                      </span>
                    </span>
                  );

                  return (
                    <li
                      key={item.segment}
                      className="lg:border-b lg:border-b-[rgba(0,71,171,0.08)] lg:last:border-b-0"
                    >
                      {item.disabled ? (
                        <span
                          aria-disabled="true"
                          className={className}
                          style={{ width: "100%" }}
                        >
                          {content}
                        </span>
                      ) : (
                        <Link
                          href={`${base}/${item.segment}`}
                          className={className}
                          aria-current={active ? "page" : undefined}
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
