"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { useDataStore } from "@/stores/dataStore";
import type { Player, PlayerRole } from "@/types";
import { setPlayerApproval, setPlayerRole } from "@/lib/admin-actions";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";

const roleLabels: Record<PlayerRole, string> = {
  player: "선수",
  captain: "감독",
  referee: "심판",
  admin: "관리자",
};

export default function AdminPlayersPage() {
  return <AdminGuard allow={["admin"]}><AdminPlayers /></AdminGuard>;
}

function AdminPlayers() {
  const store = useDataStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const reload = async () => {
    setLoading(true);
    const list = await store.fetchPlayers();
    setPlayers([...list].sort((a, b) => Number(a.isApproved) - Number(b.isApproved) || b.createdAt - a.createdAt));
    setLoading(false);
  };

  useEffect(() => {
    queueMicrotask(() => { void reload(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateApproval = async (player: Player, approved: boolean) => {
    if (savingId) return;
    setSavingId(player.id);
    setMessage(null);
    try {
      await setPlayerApproval(player.id, approved);
      setPlayers((prev) => prev.map((item) => item.id === player.id ? { ...item, isApproved: approved } : item));
      setMessage({ tone: "success", text: `${player.name} ${approved ? "승인" : "승인 취소"} 처리했습니다.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "승인 상태 변경에 실패했습니다." });
    } finally {
      setSavingId("");
    }
  };

  const updateRole = async (player: Player, role: PlayerRole) => {
    if (savingId || player.role === role) return;
    setSavingId(player.id);
    setMessage(null);
    try {
      await setPlayerRole(player.id, role);
      setPlayers((prev) => prev.map((item) => item.id === player.id ? { ...item, role } : item));
      setMessage({ tone: "success", text: `${player.name} 역할을 ${roleLabels[role]}로 변경했습니다.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "역할 변경에 실패했습니다." });
    } finally {
      setSavingId("");
    }
  };

  return (
    <AdminShell
      eyebrow="PLAYER APPROVAL"
      title="선수 승인"
      description="가입 선수의 선수카드 활성화, 운영 역할, 승인 상태를 관리합니다. 팀 감독 지정은 팀 운영의 멤버 관리에서 처리합니다."
    >
      <AdminPanel>
        <div className="border-b px-5 py-4" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
          <div className="fg-label" style={{ color: "var(--primary)" }}>PLAYERS · {players.length}</div>
          {message && (
            <div
              role="status"
              className="mt-3 text-sm font-semibold"
              style={{ color: message.tone === "success" ? "var(--primary)" : "var(--destructive)" }}
            >
              {message.text}
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-12 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>로딩 중...</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
            {players.map((player) => (
              <article key={player.id} className="p-5 transition-colors hover:bg-[#F5F7FF]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <PlayerProfilePhoto
                      src={getPlayerProfilePhotoUrl(player)}
                      alt={player.name}
                    />
                    <div>
                      <div className="fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{player.name}</div>
                      <div className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>{player.position} · #{player.number || "-"} · {roleLabels[player.role]}</div>
                    </div>
                  </div>
                  <div className="relative z-10 flex flex-wrap items-center gap-2">
                    <AdminStatusPill tone={player.isApproved ? "blue" : "red"}>{player.isApproved ? "승인됨" : "승인 대기"}</AdminStatusPill>
                    <select
                      value={player.role}
                      onChange={(event) => void updateRole(player, event.target.value as PlayerRole)}
                      disabled={savingId === player.id}
                      className="min-h-[42px] border px-3 text-sm font-bold transition-opacity disabled:cursor-wait disabled:opacity-70"
                      style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--color-fg-ink)" }}
                    >
                      {(Object.keys(roleLabels) as PlayerRole[]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                    </select>
                    {player.isApproved ? (
                      <button
                        type="button"
                        onClick={() => void updateApproval(player, false)}
                        disabled={savingId === player.id}
                        className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold transition-opacity disabled:cursor-wait disabled:opacity-70"
                        style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}
                      >
                        {savingId === player.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        취소
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateApproval(player, true)}
                        disabled={savingId === player.id}
                        className="inline-flex min-h-[42px] items-center gap-2 px-4 text-sm font-bold transition-opacity disabled:cursor-wait disabled:opacity-70"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        {savingId === player.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        승인
                      </button>
                    )}
                    {player.role === "admin" && <Shield className="h-5 w-5" style={{ color: "var(--primary)" }} />}
                  </div>
                </div>
              </article>
            ))}
            {players.length === 0 && <div className="p-16 text-center" style={{ color: "var(--color-fg-ink-muted)" }}>등록된 선수가 없습니다</div>}
          </div>
        )}
      </AdminPanel>
    </AdminShell>
  );
}
