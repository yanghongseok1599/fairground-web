"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Send, Users2 } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDataStore } from "@/stores/dataStore";
import type { Player, Team, PlayerRole } from "@/types";
import {
  countBroadcastRecipients,
  sendBroadcast,
  type BroadcastTarget,
  type BroadcastTargetType,
} from "@/lib/push-broadcast";

const ROLE_OPTIONS: { value: PlayerRole; label: string }[] = [
  { value: "player", label: "선수" },
  { value: "captain", label: "주장" },
  { value: "referee", label: "심판" },
  { value: "admin", label: "관리자" },
];

const TARGET_TABS: { value: BroadcastTargetType; label: string }[] = [
  { value: "all", label: "전체 유저" },
  { value: "role", label: "역할별" },
  { value: "team", label: "팀별" },
  { value: "user", label: "개별 유저" },
];

export default function AdminPushPage() {
  return (
    <AdminGuard allow={["admin"]}>
      <AdminPush />
    </AdminGuard>
  );
}

function AdminPush() {
  const store = useDataStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<BroadcastTargetType>("all");
  const [roleValue, setRoleValue] = useState<PlayerRole>("player");
  const [teamValue, setTeamValue] = useState("");
  const [userValue, setUserValue] = useState("");

  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([store.fetchTeams(), store.fetchPlayers()])
      .then(([t, p]) => {
        if (cancelled) return;
        const sortedTeams = [...t].sort((a, b) => a.name.localeCompare(b.name, "ko"));
        const sortedPlayers = [...p].sort((a, b) => a.name.localeCompare(b.name, "ko"));
        setTeams(sortedTeams);
        setPlayers(sortedPlayers);
        if (sortedTeams[0]) setTeamValue(sortedTeams[0].id);
        if (sortedPlayers[0]) setUserValue(sortedPlayers[0].id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = useMemo<BroadcastTarget>(() => {
    if (targetType === "role") return { type: "role", value: roleValue };
    if (targetType === "team") return { type: "team", value: teamValue };
    if (targetType === "user") return { type: "user", value: userValue };
    return { type: "all" };
  }, [targetType, roleValue, teamValue, userValue]);

  // 대상이 바뀌면 수신자 수를 다시 계산.
  useEffect(() => {
    let cancelled = false;
    // 값이 필요한 대상인데 아직 비어있으면 계산 보류.
    if ((targetType === "team" && !teamValue) || (targetType === "user" && !userValue)) {
      setCount(null);
      return;
    }
    setCounting(true);
    void countBroadcastRecipients(target)
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      })
      .finally(() => {
        if (!cancelled) setCounting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target, targetType, teamValue, userValue]);

  const canSend =
    title.trim().length > 0 && !sending && count !== null && count > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const recipients = count ?? 0;
    if (!window.confirm(`${recipients}명에게 푸시를 발송할까요?\n\n제목: ${title.trim()}`)) {
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      const sent = await sendBroadcast(title.trim(), body.trim(), target);
      setFeedback({
        tone: "ok",
        msg: `${sent}명에게 발송 요청 완료. 알림을 허용한 기기에 푸시가 도착합니다.`,
      });
      setTitle("");
      setBody("");
    } catch (err) {
      setFeedback({
        tone: "err",
        msg: err instanceof Error ? err.message : "발송에 실패했습니다.",
      });
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.92)",
    borderColor: "rgba(0,71,171,0.18)",
  } as const;

  return (
    <AdminShell
      eyebrow="PUSH BROADCAST"
      title="푸시 발송"
      description="구독자(알림 허용)에게 웹 푸시를 보냅니다. Chrome·Safari를 지원하며, iOS는 홈 화면에 추가(PWA 설치)한 사용자에게만 전달됩니다."
    >
      <AdminPanel>
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* 작성 영역 */}
          <div className="space-y-5">
            <div>
              <Label htmlFor="push-title">제목</Label>
              <Input
                id="push-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 이번 주말 경기 일정 안내"
                maxLength={80}
                className="mt-1.5"
                style={inputStyle}
              />
              <p className="mt-1 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                {title.length}/80
              </p>
            </div>

            <div>
              <Label htmlFor="push-body">내용</Label>
              <textarea
                id="push-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="알림 본문 (선택). 비워두면 제목만 표시됩니다."
                maxLength={300}
                rows={4}
                className="mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                style={inputStyle}
              />
              <p className="mt-1 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                {body.length}/300
              </p>
            </div>

            <div>
              <Label>발송 대상</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TARGET_TABS.map((tab) => {
                  const active = targetType === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setTargetType(tab.value)}
                      className="rounded-md border px-3 py-1.5 text-xs font-bold transition"
                      style={{
                        background: active ? "var(--primary)" : "rgba(255,255,255,0.9)",
                        color: active ? "var(--primary-foreground)" : "var(--color-fg-ink)",
                        borderColor: active ? "var(--primary)" : "rgba(0,71,171,0.18)",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {targetType === "role" && (
                <select
                  value={roleValue}
                  onChange={(e) => setRoleValue(e.target.value as PlayerRole)}
                  className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              )}

              {targetType === "team" && (
                <select
                  value={teamValue}
                  onChange={(e) => setTeamValue(e.target.value)}
                  className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {teams.length === 0 && <option value="">팀 없음</option>}
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}

              {targetType === "user" && (
                <select
                  value={userValue}
                  onChange={(e) => setUserValue(e.target.value)}
                  className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  {players.length === 0 && <option value="">사용자 없음</option>}
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.teamName ? ` · ${p.teamName}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 요약/발송 영역 */}
          <div className="space-y-4">
            <div
              className="rounded-lg border p-4"
              style={{ background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.16)" }}
            >
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                  예상 수신자
                </span>
              </div>
              <div className="mt-1.5 text-3xl font-black" style={{ color: "var(--color-fg-ink)" }}>
                {counting ? "…" : count === null ? "—" : `${count}명`}
              </div>
              <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--color-fg-ink-muted)" }}>
                실제 푸시는 <strong>알림을 허용한 기기</strong>에만 도착합니다. 모든 대상에게는 앱 내 알림(종)이 함께 기록됩니다.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? "발송 중…" : "푸시 발송"}
            </Button>

            {feedback && (
              <AdminStatusPill tone={feedback.tone === "ok" ? "blue" : "red"}>
                {feedback.msg}
              </AdminStatusPill>
            )}

            <div className="flex items-start gap-2 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                사용자는 사이트 헤더의 “알림 켜기”로 구독합니다. iOS는 홈 화면에 추가 후에만 푸시를 받을 수 있습니다.
              </span>
            </div>
          </div>
        </div>
      </AdminPanel>
    </AdminShell>
  );
}
