import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface EmptyStateAction {
  label: string;
  href: string;
}

interface EmptyStateProps {
  /** Short uppercase eyebrow, e.g. "NO LIVE MATCHES". */
  eyebrow?: string;
  /** Primary message (real DOM text — readable by AT and crawlers). */
  title: string;
  /** Optional supporting line. */
  description?: string;
  /** Optional CTA(s) to guide the user somewhere useful. */
  actions?: EmptyStateAction[];
}

/**
 * Shared empty-state block. Used by the landing teams/standings sections,
 * the live page, and the standings page so an empty database renders honest,
 * accessible guidance instead of a blank screen or fake demo data.
 *
 * Colours/fonts use design tokens only (no brand hex); the brand kit pass
 * re-aligns token values centrally.
 */
export function EmptyState({
  eyebrow,
  title,
  description,
  actions,
}: EmptyStateProps) {
  return (
    <div
      className="border px-6 py-16 text-center"
      style={{
        borderColor: "var(--color-fg-line-soft)",
        background: "var(--color-fg-paper-2)",
      }}
    >
      {eyebrow && (
        <div
          className="fg-label mb-3"
          style={{ color: "var(--color-fg-ink-dim)" }}
        >
          {eyebrow}
        </div>
      )}
      <p
        style={{
          color: "var(--color-fg-ink)",
          fontFamily: "var(--font-body)",
          fontWeight: 800,
          fontSize: "clamp(20px, 3vw, 28px)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </p>
      {description && (
        <p
          className="mt-3 text-[14px] leading-relaxed"
          style={{
            color: "var(--color-fg-ink-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className="group inline-flex items-center gap-2 px-5 py-3 tracking-[0.04em] text-[14px] transition-transform hover:-translate-y-0.5 border"
              style={
                i === 0
                  ? {
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderColor: "var(--primary)",
                      fontFamily: "var(--font-body)",
                      fontWeight: 700,
                    }
                  : {
                      background: "var(--color-fg-paper)",
                      color: "var(--color-fg-ink)",
                      borderColor: "var(--color-fg-line-soft)",
                      fontFamily: "var(--font-body)",
                      fontWeight: 700,
                    }
              }
            >
              {a.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
