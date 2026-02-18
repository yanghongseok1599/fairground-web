interface SectionProps {
  label?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}

export function Section({ label, title, description, children, dark, className }: SectionProps) {
  return (
    <section
      className={`py-20 px-6 md:px-10 ${className || ""}`}
      style={{ background: dark ? "#0D1B2A" : undefined }}
    >
      <div className="max-w-6xl mx-auto">
        {label && (
          <p
            className="text-[11px] uppercase tracking-[3px] mb-3"
            style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}
          >
            {label}
          </p>
        )}
        <h2
          className="mb-4 font-extrabold leading-tight"
          style={{
            fontFamily: "var(--font-outfit), Outfit, sans-serif",
            fontSize: "clamp(28px, 4vw, 42px)",
            letterSpacing: "-1.5px",
            color: dark ? "#FAFCFF" : "#0D1B2A",
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="text-base mb-10 max-w-xl leading-relaxed"
            style={{ color: dark ? "#627D98" : "#627D98" }}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
