import type { Match } from "@/types";
import { shootoutResultText } from "./model";

/** 승부차기는 정규 스코어와 분리하여 공개한다. */
export function ShootoutResultBadge({ match, className = "" }: { match: Match; className?: string }) {
  const text = shootoutResultText(match);
  if (!text) return null;
  return <p role="status" aria-live="polite" className={`break-words text-sm font-bold tabular-nums text-primary ${className}`}>{text}</p>;
}
