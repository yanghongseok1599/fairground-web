"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { useDataStore } from "@/stores/dataStore";
import type { Player, PlayerRole } from "@/types";
import { setPlayerApproval, setPlayerEligibility, setPlayerRole } from "@/lib/admin-actions";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";
import { needsKoreanNameCheck } from "@/lib/registration-profile";

const roleLabels: Record<PlayerRole, string> = {
  player: "선수",
  captain: "감독",
  referee: "심판",
  admin: "관리자",
};

// 촬영물 홍보 활용 동의 시각 표시용. toLocaleDateString("ko-KR") 은
// "2026. 8. 28." 처럼 공백/마침표가 지저분해서 직접 만든다.
function formatConsentDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

export default function AdminPlayersPage() {
  return <AdminGuard allow={["admin"]}><AdminPlayers /></AdminGuard>;
}

function AdminPlayers() {
  const store = useDataStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const consentedCount = players.filter((item) => item.portraitConsentAt).length;

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

  // 규정 제22조 — JOIN KFA 확인 결과를 반영해 선출로 지정하면, 해당 선수는
  // 출전 명단 등재와 경기 이벤트 기록이 DB 레벨에서 거부된다.
  const updateEligibility = async (player: Player, isRegisteredPlayer: boolean) => {
    if (savingId) return;
    setSavingId(player.id);
    setMessage(null);
    try {
      await setPlayerEligibility(player.id, isRegisteredPlayer);
      setPlayers((prev) => prev.map((item) =>
        item.id === player.id ? { ...item, hasPlayerExperience: isRegisteredPlayer } : item));
      setMessage({
        tone: "success",
        text: `${player.name} ${isRegisteredPlayer ? "선출로 지정 — 출전 불가" : "비선출로 지정 — 출전 가능"}`,
      });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "참가 자격 변경에 실패했습니다." });
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
          {/* 촬영물을 실제로 홍보에 쓸 때 "몇 명에게 동의를 받았는가"를 한눈에.
              미동의자는 마이페이지 동의 카드로 회수된다. */}
          <div className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
            촬영물 활용 동의 {consentedCount} / {players.length}
            {players.length > consentedCount && ` · 미동의 ${players.length - consentedCount}명`}
          </div>
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
                    {player.hasPlayerExperience && (
                      <AdminStatusPill tone="red">선출 · 출전 불가</AdminStatusPill>
                    )}
                    {/* 구글 가입은 구글 계정 이름이 그대로 들어온다. 승인 검수 때
                        운영진이 실명 여부를 함께 확인할 수 있도록 표시한다. */}
                    {needsKoreanNameCheck(player.name) && (
                      <AdminStatusPill tone="red">실명 확인 필요</AdminStatusPill>
                    )}
                    {player.portraitConsentAt ? (
                      <AdminStatusPill tone="blue">
                        촬영동의 {formatConsentDate(player.portraitConsentAt)}
                      </AdminStatusPill>
                    ) : (
                      <AdminStatusPill tone="muted">촬영 미동의</AdminStatusPill>
                    )}
                    <button
                      type="button"
                      onClick={() => void updateEligibility(player, !player.hasPlayerExperience)}
                      disabled={savingId === player.id}
                      title="규정 제22조 — JOIN KFA 확인 결과를 반영합니다"
                      className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold transition-opacity disabled:cursor-wait disabled:opacity-70"
                      style={player.hasPlayerExperience
                        ? { borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }
                        : { borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}
                    >
                      {savingId === player.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      {player.hasPlayerExperience ? "비선출로 변경" : "선출로 지정"}
                    </button>
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
