interface SectionProps {
  label?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
  chapter?: string;
}

export function Section({ label, title, description, children, dark, className, chapter }: SectionProps) {
  return (
    <section
      className={`relative py-20 md:py-24 px-5 md:px-10 ${className || ""}`}
      style={{
        background: dark
          ? "var(--color-fg-paper-2)"
          : "var(--color-fg-paper)",
      }}
    >
      {/* top hairline */}
      <div
        className="absolute top-0 left-5 right-5 md:left-10 md:right-10 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-fg-line-soft) 20%, var(--color-fg-line-soft) 80%, transparent)",
        }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-start gap-4 md:gap-6 mb-10 md:mb-14">
          {chapter && (
            <span
              className="fg-mono text-[11px] mt-2 shrink-0"
              style={{ color: "var(--primary)" }}
            >
              {chapter}
            </span>
          )}
          <div className="flex-1">
            {label && (
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block w-2 h-2"
                  style={{ background: "var(--primary)" }}
                />
                <p className="fg-label" style={{ color: "var(--primary)" }}>
                  {label}
                </p>
              </div>
            )}
            <h2
              className="fg-display"
              style={{
                fontSize: "clamp(36px, 6vw, 72px)",
                letterSpacing: "-0.01em",
                color: "var(--color-fg-ink)",
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-2xl"
                style={{
                  color: "var(--color-fg-ink-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
