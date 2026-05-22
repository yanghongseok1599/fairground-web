"use client";

import { Trophy, Target, Sparkles, Star } from "lucide-react";

interface Props {
  rating: number;
  stats: { goals: number; assists: number; mom: number };
  /** 컴팩트 모드 — 한 줄 + 가는 바. /my 카드용. */
  compact?: boolean;
}

interface Tier {
  key: "silver" | "gold" | "premium" | "max";
  label: string;
  threshold: number;
  color: string;
}

const TIERS: Tier[] = [
  { key: "silver",  label: "실버",     threshold: 80,  color: "#9CA3AF" },
  { key: "gold",    label: "골드",     threshold: 90,  color: "#D4A017" },
  { key: "premium", label: "프리미엄", threshold: 100, color: "#0047AB" },
  { key: "max",     label: "최고",     threshold: 110, color: "#7C3AED" },
];

const PREV_THRESHOLDS = [70, 80, 90, 100, 110] as const;

/**
 * 다음 등급 진행률 시각화. base 70 + (mom*3 + goals + assists) 식이라 1점=골/어시 1개, 3점=MOM 1회.
 * 만점(110) 도달 시 트로피 표시.
 */
export function CardProgress({ rating, stats, compact = false }: Props) {
  const safeRating = Math.max(70, Math.min(110, rating));

  if (safeRating >= 110) {
    return (
      <div
        className={compact ? "flex items-center gap-2" : "rounded-lg border p-4"}
        style={{
          borderColor: "var(--color-fg-line-soft)",
          background: "var(--color-fg-paper)",
        }}
      >
        <Trophy width={compact ? 16 : 20} height={compact ? 16 : 20} style={{ color: "#D4A017" }} />
        <span className="font-semibold" style={{ color: "var(--color-fg-ink)" }}>
          최고 등급 달성
        </span>
      </div>
    );
  }

  const next = TIERS.find((t) => safeRating < t.threshold)!;
  const prevThreshold =
    PREV_THRESHOLDS.slice().reverse().find((t) => safeRating >= t && t < next.threshold) ?? 70;
  const diff = next.threshold - safeRating;
  const span = next.threshold - prevThreshold;
  const pct = Math.min(100, Math.max(0, ((safeRating - prevThreshold) / span) * 100));

  const needMom = Math.ceil(diff / 3);

  if (compact) {
    return (
      <div className="flex items-center gap-3" aria-label={`${next.label}까지 ${diff}점`}>
        <div className="flex-1">
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span style={{ color: "var(--color-fg-ink-muted)" }}>
              {next.label}까지 <span className="font-bold" style={{ color: next.color }}>+{diff}점</span>
            </span>
            <span className="font-mono" style={{ color: "var(--color-fg-ink-muted)" }}>
              {safeRating}/{next.threshold}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-fg-paper-3, #EEF3FF)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: next.color }}
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: "var(--color-fg-line-soft)",
        background: "var(--color-fg-paper)",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="fg-display text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
          다음 등급
        </h3>
        <span className="text-xs font-mono" style={{ color: "var(--color-fg-ink-muted)" }}>
          현재 {safeRating} / 최대 110
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-lg font-black" style={{ color: next.color }}>
            {next.label}
          </span>
          <span className="text-sm font-bold" style={{ color: next.color }}>
            +{diff}점 필요
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-fg-paper-3, #EEF3FF)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: next.color }}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${next.label}까지 ${pct.toFixed(0)}% 진행`}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <PathItem icon={<Star width={14} height={14} />} label="MOM" value={`${needMom}회`} hint="× 3점" />
        <PathItem icon={<Target width={14} height={14} />} label="골" value={`${diff}개`} hint="× 1점" />
        <PathItem icon={<Sparkles width={14} height={14} />} label="어시" value={`${diff}개`} hint="× 1점" />
      </div>

      <p className="mt-3 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
        통산 {stats.goals}골 · {stats.assists}어시 · {stats.mom}MOM (심판 결정)
      </p>
    </div>
  );
}

function PathItem({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      className="rounded-lg px-2 py-2"
      style={{ background: "var(--color-fg-paper-3, #EEF3FF)" }}
    >
      <div className="mb-0.5 flex items-center justify-center gap-1" style={{ color: "var(--primary)" }}>
        {icon}
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
        {value}
      </div>
      <div className="text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
        {hint}
      </div>
    </div>
  );
}
