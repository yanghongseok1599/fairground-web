"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { useDataStore } from "@/stores/dataStore";
import type { Player } from "@/types";
import { setPlayerBan } from "@/lib/admin-actions";

export default function AdminPenaltiesPage() {
  return <AdminGuard allow={["admin"]}><AdminPenalties /></AdminGuard>;
}

function AdminPenalties() {
  const store = useDataStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    void store.fetchPlayers().then((list) => {
      setPlayers([...list].sort((a, b) => Number(b.penaltyStatus.isBanned) - Number(a.penaltyStatus.isBanned) || b.penaltyStatus.seasonYellowCards - a.penaltyStatus.seasonYellowCards));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateBan = async (player: Player, banned: boolean) => {
    setSavingId(player.id);
    const remaining = banned ? Math.max(player.penaltyStatus.banMatchesRemaining, 1) : 0;
    await setPlayerBan(player.id, banned, remaining);
    setPlayers((prev) => prev.map((item) => item.id === player.id ? { ...item, penaltyStatus: { ...item.penaltyStatus, isBanned: banned, banMatchesRemaining: remaining } } : item));
    setSavingId("");
  };

  return (
    <AdminShell
      eyebrow="PENALTY CONTROL"
      title="페널티 관리"
      description="경고 누적과 출전 정지 상태를 확인하고, 안전한 리그 운영을 위해 즉시 조정합니다."
    >
      <AdminPanel>
        <div className="border-b px-5 py-4" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
          <div className="fg-label" style={{ color: "var(--primary)" }}>PENALTY LEDGER</div>
        </div>
        {loading ? <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>로딩 중...</div> : (
          <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
            {players.map((player) => (
              <article key={player.id} className="p-5 transition-colors hover:bg-[#F5F7FF]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center border" style={{ background: player.penaltyStatus.isBanned ? "rgba(255,59,48,0.08)" : "var(--color-fg-paper-3)", borderColor: player.penaltyStatus.isBanned ? "rgba(255,59,48,0.20)" : "rgba(0,71,171,0.18)", color: player.penaltyStatus.isBanned ? "var(--destructive)" : "var(--primary)" }}>
                      {player.penaltyStatus.isBanned ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{player.name}</div>
                      <div className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>{player.position} · 시즌 경고 {player.penaltyStatus.seasonYellowCards}장 · 정지 {player.penaltyStatus.banMatchesRemaining}경기</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusPill tone={player.penaltyStatus.isBanned ? "red" : "blue"}>{player.penaltyStatus.isBanned ? "출전 정지" : "정상"}</AdminStatusPill>
                    {player.penaltyStatus.isBanned ? (
                      <button onClick={() => void updateBan(player, false)} disabled={savingId === player.id} className="inline-flex min-h-[42px] items-center justify-center gap-2 px-4 text-sm font-bold" style={{ background: "var(--primary)", color: "#fff" }}><ShieldCheck className="h-4 w-4" /> 정지 해제</button>
                    ) : (
                      <button onClick={() => void updateBan(player, true)} disabled={savingId === player.id} className="inline-flex min-h-[42px] items-center justify-center gap-2 border px-4 text-sm font-bold" style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}><AlertTriangle className="h-4 w-4" /> 1경기 정지</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}
