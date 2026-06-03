"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AdminShellProps {
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}

export function AdminShell({
  eyebrow,
  title,
  description,
  backHref = "/admin",
  backLabel = "운영 콘솔",
  children,
  aside,
}: AdminShellProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden pt-[60px]" style={{ background: "var(--color-fg-paper)" }}>
      <div className="absolute inset-0 fg-grid opacity-60 pointer-events-none" />
      <div
        className="absolute inset-x-0 top-0 h-[520px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 12% 8%, rgba(0,71,171,0.16), transparent 30%), radial-gradient(circle at 88% 10%, rgba(0,71,171,0.10), transparent 34%), linear-gradient(180deg, rgba(245,247,255,0.95), rgba(255,255,255,0))",
        }}
      />

      <div className="relative mx-auto max-w-[1320px] px-5 py-7 md:px-10 md:py-14">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-2 md:mb-10 md:gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-[36px] items-center gap-1.5 border px-3 text-xs font-bold transition-transform hover:-translate-y-0.5 md:min-h-[44px] md:gap-2 md:px-4 md:text-sm"
            style={{
              background: "rgba(255,255,255,0.78)",
              borderColor: "rgba(0,71,171,0.18)",
              color: "var(--primary)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>

          {user && (
            <button
              type="button"
              onClick={async () => {
                await logout();
                router.push("/");
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 border px-3 text-xs font-bold transition-transform hover:-translate-y-0.5 md:min-h-[44px] md:gap-2 md:px-4 md:text-sm"
              style={{
                background: "rgba(255,59,48,0.08)",
                borderColor: "rgba(255,59,48,0.22)",
                color: "var(--destructive)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          )}
        </div>

        <section className="grid gap-5 md:gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 md:mb-5 md:gap-3">
              <span className="fg-mono text-[11px]" style={{ color: "var(--primary)" }}>OPS</span>
              <span className="h-2 w-2" style={{ background: "var(--primary)" }} />
              <span className="fg-label" style={{ color: "var(--color-fg-blue)" }}>{eyebrow}</span>
            </div>
            <h1
              className="fg-display font-black"
              style={{
                fontSize: "clamp(48px, 8vw, 112px)",
                lineHeight: 0.9,
                letterSpacing: "-0.035em",
                color: "var(--color-fg-blue-deep)",
                textShadow: "0 8px 22px rgba(0,71,171,0.10)",
              }}
            >
              {title}
            </h1>
            <p
              className="mt-4 max-w-[640px] text-[13px] leading-relaxed md:mt-7 md:text-[17px]"
              style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-body)" }}
            >
              {description}
            </p>
          </div>
          {aside}
        </section>

        <section className="mt-8 md:mt-16">{children}</section>
      </div>
    </main>
  );
}

interface AdminTileProps {
  href: string;
  icon: LucideIcon;
  index: string;
  title: string;
  description: string;
  meta?: string;
}

export function AdminTile({ href, icon: Icon, index, title, description, meta }: AdminTileProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden border p-3 transition-transform hover:-translate-y-1 md:p-6"
      style={{
        background: "rgba(255,255,255,0.84)",
        borderColor: "rgba(0,71,171,0.16)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div className="absolute inset-0 fg-scanlines opacity-60 pointer-events-none" />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-2 md:mb-8 md:gap-4">
          <div className="fg-mono text-[9px] md:text-[11px]" style={{ color: "var(--primary)" }}>{index}</div>
          <div
            className="flex h-8 w-8 items-center justify-center border md:h-12 md:w-12"
            style={{ borderColor: "rgba(0,71,171,0.22)", background: "var(--color-fg-paper-3)", color: "var(--primary)" }}
          >
            <Icon className="h-4 w-4 md:h-6 md:w-6" />
          </div>
        </div>
        <h2 className="fg-display text-base font-black leading-tight md:text-2xl" style={{ color: "var(--color-fg-ink)" }}>{title}</h2>
        <p className="hidden md:mt-3 md:block md:min-h-[48px] md:text-sm md:leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>{description}</p>
        <div className="mt-4 flex items-center justify-between border-t pt-3 md:mt-8 md:pt-4" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
          <span className="fg-label text-[9px] md:text-[10px]" style={{ color: "var(--primary)" }}>{meta ?? "OPEN MODULE"}</span>
          <span className="transition-transform group-hover:translate-x-1" style={{ color: "var(--primary)" }}>→</span>
        </div>
      </div>
    </Link>
  );
}

export function AdminPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`border ${className}`}
      style={{
        background: "rgba(255,255,255,0.86)",
        borderColor: "rgba(0,71,171,0.14)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {children}
    </div>
  );
}

export function AdminStatusPill({ tone, children }: { tone: "blue" | "red" | "muted"; children: React.ReactNode }) {
  const style =
    tone === "blue"
      ? { background: "var(--color-fg-paper-3)", color: "var(--primary)", borderColor: "rgba(0,71,171,0.20)" }
      : tone === "red"
        ? { background: "rgba(255,59,48,0.08)", color: "var(--destructive)", borderColor: "rgba(255,59,48,0.20)" }
        : { background: "rgba(13,27,42,0.04)", color: "var(--color-fg-ink-muted)", borderColor: "rgba(13,27,42,0.10)" };

  return <span className="inline-flex items-center border px-2.5 py-1 text-xs font-bold" style={style}>{children}</span>;
}
