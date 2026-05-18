"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import { BoardPage } from "@/components/board-page";
import type { Team, Player } from "@/types";
import { ArrowLeft, Users } from "lucide-react";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [t, ps] = await Promise.all([
        store.fetchTeam(id),
        store.fetchTeamPlayers(id),
      ]);
      setTeam(t ?? null);
      const resolvedPlayers = ps.filter((p) => p.isApproved).sort((a, b) => b.cardRating - a.cardRating);
      setPlayers(resolvedPlayers);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return (
    <div className="pt-[60px] min-h-screen flex items-center justify-center" style={{ background: "var(--foreground)" }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
    </div>
  );
  if (!team) return (
    <div className="pt-[60px] min-h-screen flex items-center justify-center" style={{ background: "var(--foreground)", color: "var(--color-fg-ink-dim)" }}>
      팀을 찾을 수 없습니다
    </div>
  );

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--foreground)" }}>
      <div className="py-10 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <Link href="/teams" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors" style={{ color: "var(--color-fg-ink-dim)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-fg-ink-dim)"; }}
          >
            <ArrowLeft className="h-4 w-4" /> 팀 목록
          </Link>

          <div className="flex items-start gap-6">
            {team.logo ? (
              <img src={team.logo} alt={team.name} className="w-20 h-20 rounded-2xl object-cover border" style={{ borderColor: "rgba(0,71,171,0.2)" }} />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl" style={{ fontFamily: "var(--font-outfit)", background: "var(--color-fg-navy-light)", color: "var(--primary)" }}>
                {team.name.slice(0, 2)}
              </div>
            )}
            <div>
              <h1 className="font-black leading-none mb-1" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(28px, 5vw, 48px)", letterSpacing: "-2px", color: "var(--background)" }}>
                {team.name}
              </h1>
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>
                <Users className="h-4 w-4" />
                <span>{team.memberCount}명</span>
                {team.foundedYear && <><span>·</span><span>{team.foundedYear}년 창단</span></>}
              </div>
            </div>
          </div>

          {/* Season stats */}
          {team.seasonStats && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "승점", value: team.seasonStats.points },
                { label: "경기", value: team.seasonStats.gamesPlayed },
                { label: "승", value: team.seasonStats.wins },
                { label: "무", value: team.seasonStats.draws },
                { label: "패", value: team.seasonStats.losses },
                { label: "득점", value: team.seasonStats.goalsFor },
                { label: "실점", value: team.seasonStats.goalsAgainst },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(0,71,171,0.08)", border: "1px solid rgba(0,71,171,0.15)" }}>
                  <div className="font-black text-xl tabular-nums mb-0.5" style={{ fontFamily: "var(--font-outfit)", color: "var(--background)" }}>{s.value}</div>
                  <div className="text-[10px] uppercase" style={{ fontFamily: "var(--font-space-mono)", color: "var(--color-fg-ink-dim)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Roster */}
      <div className="px-6 md:px-10 py-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: "var(--font-outfit)", color: "var(--background)", letterSpacing: "-0.5px" }}>
            선수 로스터 ({players.length}명)
          </h2>
          {players.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>등록된 선수가 없습니다</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {players.map((p) => (
                <Link key={p.id} href={`/players/${p.id}`} className="hover:scale-105 transition-transform">
                  <PlayerCard player={p} size="sm" teamLogo={team.logo} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Board */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "var(--foreground)" }}>
        <div className="px-6 md:px-10 pt-8 pb-2 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-outfit)", color: "var(--background)", letterSpacing: "-0.5px" }}>
            팀 게시판
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--color-fg-ink-dim)" }}>팀원만 글을 작성할 수 있습니다</p>
        </div>
        <BoardPage
          pageTitle=""
          pageSubtitle=""
          label=""
          accentColor="var(--primary)"
          dbPath={`teamBoard/${id}`}
          writeRole="team"
          requiredTeamId={id}
          hideHeader
        />
      </div>
    </div>
  );
}
