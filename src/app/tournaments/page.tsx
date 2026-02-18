"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import type { Tournament } from "@/types";
import { Calendar, MapPin, ArrowRight } from "lucide-react";

const statusLabel: Record<string, string> = { upcoming: "예정", ongoing: "진행중", completed: "종료" };
const statusStyle: Record<string, { bg: string; color: string }> = {
  upcoming: { bg: "rgba(79,195,247,0.15)", color: "#4FC3F7" },
  ongoing: { bg: "rgba(0,200,83,0.15)", color: "#00C853" },
  completed: { bg: "rgba(98,125,152,0.2)", color: "#627D98" },
};

export default function TournamentsPage() {
  const store = useDataStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    store.fetchTournaments().then((list) => {
      setTournaments(list.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pt-[60px]">
      <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>
            Tournaments
          </p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
            대회 목록
          </h1>
        </div>
      </div>

      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="py-16 text-center text-fg-gray-500">불러오는 중...</div>
          ) : tournaments.length === 0 ? (
            <div className="py-16 text-center text-fg-gray-500">등록된 대회가 없습니다</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((t) => {
                const s = statusStyle[t.status] || statusStyle.completed;
                return (
                  <Link key={t.id} href={`/tournaments/${t.id}`}>
                    <div className="rounded-2xl border border-fg-gray-200 p-6 bg-white transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer h-full flex flex-col">
                      {/* Status badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className="text-[10px] uppercase tracking-[2px] px-3 py-1 rounded-full font-semibold"
                          style={{ background: s.bg, color: s.color, fontFamily: "var(--font-space-mono)" }}
                        >
                          {statusLabel[t.status] || t.status}
                        </span>
                        {t.winningTeamName && (
                          <span className="text-xs text-fg-gold-warm font-semibold">🏆 {t.winningTeamName}</span>
                        )}
                      </div>
                      <h3
                        className="text-xl font-bold mb-3 leading-tight flex-1"
                        style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A", letterSpacing: "-0.5px" }}
                      >
                        {t.name}
                      </h3>
                      <div className="space-y-1.5 mt-auto">
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#627D98" }}>
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#627D98" }}>
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{t.location}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-xs font-medium" style={{ color: "#00C853" }}>
                        상세 보기 <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
