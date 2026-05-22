"use client";

import Link from "next/link";
import { AlertTriangle, Gamepad2, Shield, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/admin-guard";
import { AdminShell, AdminTile } from "@/components/admin-shell";
import { getAdminMenuItems } from "@/lib/admin-menu";

const ICONS = {
  matches: Gamepad2,
  players: UserCheck,
  referees: ShieldCheck,
  teams: Users,
  coaches: Shield,
  penalties: AlertTriangle,
};

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}

function AdminDashboard() {
  const { player } = useAuth();
  if (!player) return null;

  const visibleItems = getAdminMenuItems(player.role);

  return (
    <AdminShell
      backHref="/"
      backLabel="사이트로 돌아가기"
      eyebrow="FAIRGROUND CONTROL ROOM"
      title="운영 콘솔"
      description="FairGround의 경기, 선수카드, 팀 승인, 페널티 운영을 브랜드 사이트와 같은 스타디움 라이트 컨셉에서 관리합니다."
      aside={
        <div
          className="border p-6"
          style={{
            background: "rgba(255,255,255,0.82)",
            borderColor: "rgba(0,71,171,0.16)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Sparkles className="mb-5 h-7 w-7" style={{ color: "var(--primary)" }} />
          <div className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>SIGNED IN</div>
          <div className="mt-2 fg-display text-3xl font-black" style={{ color: "var(--color-fg-ink)" }}>{player.name}</div>
          <div className="mt-5 inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "rgba(0,71,171,0.18)", background: "var(--color-fg-paper-3)", color: "var(--primary)" }}>
            <Shield className="h-3.5 w-3.5" />
            {player.role === "admin" ? "관리자" : "심판"}
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item, index) => {
          const Icon = ICONS[item.metricKey];
          return (
            <AdminTile
              key={item.href}
              href={item.href}
              icon={Icon}
              index={`0${index + 1}`}
              title={item.title}
              description={item.description}
              meta={item.metricKey.toUpperCase()}
            />
          );
        })}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/teams" className="inline-flex min-h-[48px] items-center border px-6 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ borderColor: "rgba(0,71,171,0.20)", background: "rgba(255,255,255,0.72)", color: "var(--primary)" }}>
          공개 팀 페이지 확인
        </Link>
        <Link href="/live" className="inline-flex min-h-[48px] items-center px-6 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ background: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 14px 30px rgba(0,71,171,0.20)" }}>
          라이브 화면 보기
        </Link>
      </div>
    </AdminShell>
  );
}
