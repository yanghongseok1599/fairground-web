"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import type { Team, Player } from "@/types";
import { ArrowLeft, ClipboardList, CreditCard, MessageSquare, Users } from "lucide-react";

function HubCard({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-3xl border p-5 shadow-sm transition-transform hover:-translate-y-1" style={{ borderColor: "rgba(0,71,171,0.14)", background: "rgba(255,255,255,0.86)" }}>
      <div className="absolute inset-0 fg-scanlines opacity-40 pointer-events-none" />
      <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border" style={{ background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)" }}>{icon}</div>
      <h2 className="relative fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{title}</h2>
      <p className="relative mt-2 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>{desc}</p>
    </Link>
  );
}

export default function TeamClubPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    void Promise.all([store.fetchTeam(id), store.fetchTeamPlayers(id)]).then(([resolvedTeam, resolvedPlayers]) => {
      setTeam(resolvedTeam ?? null);
      setPlayers(resolvedPlayers.filter((player) => player.isApproved));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10 pt-[92px] md:px-10" style={{ background: "var(--color-fg-paper)" }}>
      <div className="absolute inset-0 fg-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[420px] pointer-events-none" style={{ background: "radial-gradient(circle at 16% 8%, rgba(0,71,171,0.14), transparent 32%), linear-gradient(180deg, rgba(245,247,255,0.92), rgba(255,255,255,0))" }} />
      <div className="relative z-10 mx-auto max-w-5xl">
        <Link href={`/teams/${id}`} className="mb-8 inline-flex items-center gap-2 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          <ArrowLeft className="h-4 w-4" /> 팀 홈
        </Link>
        <div className="mb-8 rounded-[32px] border p-6 shadow-sm" style={{ borderColor: "rgba(0,71,171,0.14)", background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(238,243,255,0.82))" }}>
          <p className="fg-label text-[11px] uppercase tracking-[3px]" style={{ color: "var(--primary)", fontFamily: "var(--font-space-mono)" }}>CLUBHOUSE</p>
          <h1 className="mt-3 fg-display text-4xl font-black md:text-6xl" style={{ color: "var(--color-fg-ink)", fontFamily: "var(--font-outfit)", letterSpacing: "-1.8px" }}>
            {team?.name ?? "팀"} 운영실
          </h1>
          <p className="mt-4 max-w-2xl" style={{ color: "var(--color-fg-ink-muted)" }}>
            공지, 채팅, 회비, 팀원 관리를 한 곳에서 처리하는 팀원 전용 대시보드입니다.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.82)" }}><div className="text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>{players.length}</div><div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>승인 선수</div></div>
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.82)" }}><div className="text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>0</div><div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>읽지 않은 공지</div></div>
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.82)" }}><div className="text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>MVP</div><div className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>운영 모드</div></div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <HubCard href={`/teams/${id}/notices`} title="공지사항" desc="팀 공지 작성, 댓글, 읽음 체크 구조를 시작합니다." icon={<ClipboardList className="h-6 w-6" />} />
          <HubCard href={`/teams/${id}/dues`} title="회비 장부" desc="월별 회비와 지출, 미납자 현황을 관리합니다." icon={<CreditCard className="h-6 w-6" />} />
          <HubCard href={`/teams/${id}/chat`} title="팀 게시판" desc="팀 내부 글과 댓글을 FairGround 기록과 연결합니다." icon={<MessageSquare className="h-6 w-6" />} />
          <HubCard href={`/teams/${id}/members`} title="멤버 관리" desc="초대 링크, 선수 승인, 역할 관리를 준비합니다." icon={<Users className="h-6 w-6" />} />
        </div>
      </div>
    </main>
  );
}
