"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, Bell, ClipboardCheck, Flag, Gamepad2, Layers, Megaphone, Wallet, Shield, ShieldCheck, Sparkles, Target, UserCheck, Users } from "lucide-react";
import { useInspectionAccess } from "@/features/player-inspection/use-inspection-access";
import { useAuth } from "@/hooks/useAuth";
import { AdminGuard } from "@/components/admin-guard";
import { AdminShell, AdminTile } from "@/components/admin-shell";
import { getAdminMenuItems } from "@/lib/admin-menu";

const ICONS = {
  surveyResults: BarChart3,
  inspections: ClipboardCheck,
  matches: Gamepad2,
  groups: Layers,
  entryFees: Wallet,
  players: UserCheck,
  referees: ShieldCheck,
  teams: Users,
  coaches: Shield,
  penalties: AlertTriangle,
  reports: Flag,
  skillChallenge: Target,
  popups: Megaphone,
  push: Bell,
};

export default function AdminPage() {
  return (
    <AdminGuard allowInspectionOperator>
      <AdminDashboard />
    </AdminGuard>
  );
}

function AdminDashboard() {
  const { player } = useAuth();
  const { allowed: canInspect } = useInspectionAccess();
  if (!player) return null;

  const visibleItems = getAdminMenuItems(player.role, canInspect);

  return (
    <AdminShell
      backHref="/"
      backLabel="사이트로 돌아가기"
      eyebrow="FAIRGROUND CONTROL ROOM"
      title="운영 콘솔"
      description={player.role === "admin" ? "경기, 선수, 팀 승인과 대회 운영을 관리합니다." : canInspect ? "현장 선수 본인을 확인하고 검인 완료·미완료 상태를 관리합니다." : "담당 경기의 진행과 결과를 관리합니다."}
      aside={
        <div
          className="border p-4 md:p-6"
          style={{
            background: "rgba(255,255,255,0.82)",
            borderColor: "rgba(0,71,171,0.16)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Sparkles className="mb-3 h-5 w-5 md:mb-5 md:h-7 md:w-7" style={{ color: "var(--primary)" }} />
          <div className="fg-label text-[9px] md:text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>SIGNED IN</div>
          <div className="mt-1 fg-display text-2xl font-black md:mt-2 md:text-3xl" style={{ color: "var(--color-fg-ink)" }}>{player.name}</div>
          <div className="mt-3 inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold md:mt-5 md:gap-2 md:px-3 md:py-1.5 md:text-xs" style={{ borderColor: "rgba(0,71,171,0.18)", background: "var(--color-fg-paper-3)", color: "var(--primary)" }}>
            <Shield className="h-3 w-3 md:h-3.5 md:w-3.5" />
            {player.role === "admin" ? "관리자" : player.role === "referee" ? "심판" : "검인 담당"}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
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
      <div className="mt-6 flex flex-wrap gap-2 md:mt-8 md:gap-3">
        <Link href="/teams" className="inline-flex min-h-[38px] items-center border px-4 fg-display text-xs transition-transform hover:-translate-y-0.5 md:min-h-[48px] md:px-6 md:text-sm" style={{ borderColor: "rgba(0,71,171,0.20)", background: "rgba(255,255,255,0.72)", color: "var(--primary)" }}>
          공개 팀 페이지 확인
        </Link>
        <Link href="/live" className="inline-flex min-h-[38px] items-center px-4 fg-display text-xs transition-transform hover:-translate-y-0.5 md:min-h-[48px] md:px-6 md:text-sm" style={{ background: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 14px 30px rgba(0,71,171,0.20)" }}>
          라이브 화면 보기
        </Link>
      </div>
    </AdminShell>
  );
}
