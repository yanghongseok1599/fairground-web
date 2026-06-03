"use client";

import { Shield, ShieldCheck, UsersRound } from "lucide-react";
import type { PlayerRole } from "@/types";

const ROLE_META: Partial<Record<PlayerRole, { label: string; color: string; bg: string; border: string; Icon: typeof Shield }>> = {
  admin: {
    label: "관리자",
    color: "var(--primary)",
    bg: "rgba(0,71,171,0.08)",
    border: "rgba(0,71,171,0.20)",
    Icon: Shield,
  },
  referee: {
    label: "심판",
    color: "var(--color-fg-blue-deep)",
    bg: "rgba(13,27,42,0.06)",
    border: "rgba(13,27,42,0.14)",
    Icon: ShieldCheck,
  },
  captain: {
    label: "감독",
    color: "var(--color-fg-ink)",
    bg: "rgba(0,71,171,0.05)",
    border: "rgba(0,71,171,0.14)",
    Icon: UsersRound,
  },
};

export function AuthorRoleBadge({ role }: { role?: PlayerRole }) {
  const meta = role ? ROLE_META[role] : undefined;
  if (!meta) return null;
  const { Icon } = meta;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{
        color: meta.color,
        background: meta.bg,
        borderColor: meta.border,
      }}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
