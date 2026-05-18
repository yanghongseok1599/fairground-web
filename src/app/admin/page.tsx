"use client";

import Link from "next/link";
import { Shield, Users, UserCheck, AlertTriangle, Gamepad2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AdminHeader } from "@/components/admin-header";
import { AdminGuard } from "@/components/admin-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const menuItems = [
    {
      title: "경기 관리",
      description: "라이브 경기 운영, 타이머, 스코어 입력",
      icon: Gamepad2,
      href: "/admin/matches",
      roles: ["admin", "referee"],
    },
    {
      title: "선수 승인",
      description: "가입 신청 선수 승인/거부",
      icon: UserCheck,
      href: "/admin",
      roles: ["admin"],
    },
    {
      title: "팀 관리",
      description: "팀 생성 승인, 팀 정보 관리",
      icon: Users,
      href: "/admin",
      roles: ["admin"],
    },
    {
      title: "페널티 관리",
      description: "페널티 부여, 오심 정정",
      icon: AlertTriangle,
      href: "/admin",
      roles: ["admin"],
    },
  ];

  const visibleItems = menuItems.filter((item) =>
    item.roles.includes(player.role),
  );

  return (
    <div className="min-h-screen pb-4" style={{ background: "var(--background)" }}>
      <AdminHeader title="관리자" />

      <div className="mx-auto max-w-md space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {player.role === "admin" ? "관리자" : "심판"} - {player.name}
          </span>
        </div>

        {visibleItems.map((item) => (
          <Link key={item.title} href={item.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <item.icon
                  className="h-5 w-5"
                  style={{ color: "var(--accent-gold)" }}
                />
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className="text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
