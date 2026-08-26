"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Eye, EyeOff, Loader2, Save, Shuffle, Trash2, Users } from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { useDataStore } from "@/stores/dataStore";
import { setTournamentGroups } from "@/lib/admin-actions";
import { splitIntoGroups, GROUP_NAMES } from "@/lib/tournament-groups";
import { buildCueSheet, cueSheetToCsv, type CueSheetSettings } from "@/lib/cue-sheet";
import { setTournamentFixturesPublished } from "@/lib/admin-actions";
import type { Team, Tournament, TournamentGroup } from "@/types";

export default function AdminTournamentsPage() {
  return <AdminGuard allow={["admin"]}><AdminTournaments /></AdminGuard>;
}

function AdminTournaments() {
  const store = useDataStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  // teamId → 조 이름(A/B). 미배정 팀은 여기 없다.
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [cue, setCue] = useState<CueSheetSettings>({
    startTime: "10:00",
    lunchStart: "13:00",
    lunchMinutes: 50,
  });
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const [list, teamList] = await Promise.all([
          store.fetchAllTournaments(),
          store.fetchTeams(),
        ]);
        setTournaments(list);
        // 승인된 팀만 편성 대상이다. 대기 팀을 조에 넣으면 승인 전에
        // 대진이 만들어져 버린다.
        setTeams(teamList.filter((t) => t.isApproved));
        if (list.length > 0) setTournamentId((cur) => cur || list[0].id);
        setLoading(false);
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = tournaments.find((t) => t.id === tournamentId) ?? null;

  // 대회를 바꾸면 저장된 조 편성을 화면 상태로 되돌린다.
  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const group of selected.groups ?? []) {
      for (const teamId of group.teamIds) next[teamId] = group.name;
    }
    setAssignment(next);
    setMessage(null);
  }, [selected]);

  const grouped = useMemo(() => {
    const buckets: Record<string, Team[]> = {};
    for (const name of GROUP_NAMES) buckets[name] = [];
    const unassigned: Team[] = [];
    for (const team of teams) {
      const name = assignment[team.id];
      if (name && buckets[name]) buckets[name].push(team);
      else unassigned.push(team);
    }
    return { buckets, unassigned };
  }, [teams, assignment]);

  const assign = (teamId: string, groupName: string | null) => {
    setAssignment((prev) => {
      const next = { ...prev };
      if (groupName) next[teamId] = groupName;
      else delete next[teamId];
      return next;
    });
    setMessage(null);
  };

  const autoSplit = () => {
    setAssignment(splitIntoGroups(teams));
    setMessage(null);
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const groups: TournamentGroup[] = GROUP_NAMES.map((name) => {
        const members = grouped.buckets[name] ?? [];
        // 기존 순위표는 보존한다. 조 편성만 바꾸는 화면이라 경기 결과를
        // 날려서는 안 된다.
        const previous = selected.groups?.find((g) => g.name === name);
        return {
          id: previous?.id ?? `group-${name}`,
          name,
          teamIds: members.map((t) => t.id),
          standings: (previous?.standings ?? []).filter((s) =>
            members.some((t) => t.id === s.teamId),
          ),
        };
      }).filter((g) => g.teamIds.length > 0);

      await setTournamentGroups(selected.id, groups);
      setTournaments((prev) =>
        prev.map((t) => (t.id === selected.id ? { ...t, groups } : t)),
      );
      const summary = groups.map((g) => `${g.name}조 ${g.teamIds.length}팀`).join(" · ");
      setMessage({ tone: "success", text: `저장했습니다 — ${summary || "편성 없음"}` });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "저장에 실패했습니다.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      eyebrow="OPS · GROUPS"
      title="조 편성"
      description="승인된 참가팀을 조로 나눕니다. 조별 리그 대진은 여기서 나눈 조를 기준으로 만듭니다."
    >
      <AdminPanel className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
          </div>
        ) : tournaments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            등록된 대회가 없습니다.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={tournamentId}
                onChange={(event) => setTournamentId(event.target.value)}
                className="min-h-[42px] border px-3 text-sm font-bold"
                style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--color-fg-ink)" }}
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={autoSplit}
                disabled={teams.length === 0}
                className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}
              >
                <Shuffle className="h-4 w-4" /> 자동 배분
              </button>

              <button
                type="button"
                onClick={() => setAssignment({})}
                disabled={Object.keys(assignment).length === 0}
                className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: "rgba(13,27,42,0.12)", background: "#fff", color: "var(--color-fg-ink-muted)" }}
              >
                <Trash2 className="h-4 w-4" /> 전체 해제
              </button>

              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="ml-auto inline-flex min-h-[42px] items-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "저장 중..." : "조 편성 저장"}
              </button>
            </div>

            {message && (
              <p
                role="status"
                className="mt-4 border px-3 py-2.5 text-sm font-bold"
                style={message.tone === "success"
                  ? { background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.20)", color: "var(--primary)" }
                  : { background: "rgba(255,59,48,0.08)", borderColor: "rgba(255,59,48,0.20)", color: "var(--destructive)" }}
              >
                {message.text}
              </p>
            )}

            <CueSheetSection
              settings={cue}
              onChange={setCue}
              groups={GROUP_NAMES.map((name) => ({
                name,
                teamNames: (grouped.buckets[name] ?? []).map((t) => t.name),
              })).filter((g) => g.teamNames.length > 0)}
              published={Boolean(selected?.fixturesPublished)}
              publishing={publishing}
              onTogglePublish={async () => {
                if (!selected || publishing) return;
                setPublishing(true);
                try {
                  const next = !selected.fixturesPublished;
                  await setTournamentFixturesPublished(selected.id, next);
                  setTournaments((prev) =>
                    prev.map((t) => (t.id === selected.id ? { ...t, fixturesPublished: next } : t)),
                  );
                  setMessage({
                    tone: "success",
                    text: next
                      ? "대진을 공개했습니다 — 참가팀이 예정 경기를 볼 수 있습니다."
                      : "대진을 비공개로 전환했습니다 — 참가팀에게 보이지 않습니다.",
                  });
                } catch (error) {
                  setMessage({
                    tone: "error",
                    text: error instanceof Error ? error.message : "공개 설정 변경에 실패했습니다.",
                  });
                } finally {
                  setPublishing(false);
                }
              }}
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {GROUP_NAMES.map((name) => (
                <GroupColumn
                  key={name}
                  title={`${name}조`}
                  teams={grouped.buckets[name] ?? []}
                  onRemove={(id) => assign(id, null)}
                />
              ))}
              <GroupColumn
                title="미배정"
                teams={grouped.unassigned}
                muted
                actions={(team) =>
                  GROUP_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => assign(team.id, name)}
                      className="border px-2 py-1 text-xs font-bold"
                      style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}
                    >
                      {name}
                    </button>
                  ))
                }
              />
            </div>
          </>
        )}
      </AdminPanel>
    </AdminShell>
  );
}

function GroupColumn({
  title, teams, muted = false, onRemove, actions,
}: {
  title: string;
  teams: Team[];
  muted?: boolean;
  onRemove?: (teamId: string) => void;
  actions?: (team: Team) => React.ReactNode;
}) {
  return (
    <div className="border p-4" style={{ borderColor: "rgba(0,71,171,0.14)", background: muted ? "rgba(13,27,42,0.02)" : "#fff" }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>{title}</h3>
        <AdminStatusPill tone={muted ? "muted" : "blue"}>{teams.length}팀</AdminStatusPill>
      </div>
      {teams.length === 0 ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
          {muted ? "모두 배정되었습니다" : "배정된 팀 없음"}
        </p>
      ) : (
        <ul className="space-y-2">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center justify-between gap-2 border px-3 py-2"
                style={{ borderColor: "rgba(13,27,42,0.08)" }}>
              <span className="flex min-w-0 items-center gap-2">
                <Users className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-fg-ink-ghost)" }} />
                <span className="truncate text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>{team.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {actions?.(team)}
                {onRemove && (
                  <button type="button" onClick={() => onRemove(team.id)}
                          className="border px-2 py-1 text-xs font-bold"
                          style={{ borderColor: "rgba(13,27,42,0.12)", background: "#fff", color: "var(--color-fg-ink-muted)" }}>
                    해제
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CueSheetSection({
  settings, onChange, groups, published, publishing, onTogglePublish,
}: {
  settings: CueSheetSettings;
  onChange: (next: CueSheetSettings) => void;
  groups: { name: string; teamNames: string[] }[];
  published: boolean;
  publishing: boolean;
  onTogglePublish: () => void;
}) {
  const result = useMemo(() => buildCueSheet(groups, settings), [groups, settings]);

  const download = () => {
    const blob = new Blob(["﻿" + cueSheetToCsv(result.rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fairground-cuesheet.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const field = {
    borderColor: "rgba(0,71,171,0.18)",
    background: "#fff",
    color: "var(--color-fg-ink)",
  };

  return (
    <div className="mt-6 border p-4" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>큐시트</h3>
        <AdminStatusPill tone={published ? "red" : "muted"}>
          {published ? "대진 공개 중" : "비공개 — 참가팀에게 안 보임"}
        </AdminStatusPill>

        <button
          type="button"
          onClick={onTogglePublish}
          disabled={publishing}
          className="ml-auto inline-flex min-h-[38px] items-center gap-2 border px-3 text-sm font-bold disabled:opacity-60"
          style={published
            ? { borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }
            : { borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {published ? "대진 비공개로" : "대진 공개하기"}
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
        아래 큐시트는 <strong>운영진 화면에만</strong> 표시됩니다. 참가팀이 보는 대회
        페이지의 예정 경기는 위 <strong>대진 공개하기</strong>를 눌러야 나타납니다.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>시작</span>
          <input type="time" value={settings.startTime}
                 onChange={(e) => onChange({ ...settings, startTime: e.target.value })}
                 className="min-h-[38px] border px-2 text-sm font-bold" style={field} />
        </label>
        <label className="grid gap-1">
          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>점심 시작</span>
          <input type="time" value={settings.lunchStart}
                 onChange={(e) => onChange({ ...settings, lunchStart: e.target.value })}
                 className="min-h-[38px] border px-2 text-sm font-bold" style={field} />
        </label>
        <label className="grid gap-1">
          <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>점심(분)</span>
          <input type="number" min={0} max={180} value={settings.lunchMinutes}
                 onChange={(e) => onChange({ ...settings, lunchMinutes: Number(e.target.value) })}
                 className="min-h-[38px] w-24 border px-2 text-sm font-bold" style={field} />
        </label>
        <button type="button" onClick={download} disabled={result.rows.length === 0}
                className="inline-flex min-h-[38px] items-center gap-2 border px-3 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: "rgba(0,71,171,0.18)", background: "#fff", color: "var(--primary)" }}>
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      {result.warnings.map((w) => (
        <p key={w} className="mt-3 flex items-start gap-2 border px-3 py-2 text-xs font-bold"
           style={{ borderColor: "rgba(255,59,48,0.20)", background: "rgba(255,59,48,0.08)", color: "var(--destructive)" }}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}
        </p>
      ))}

      {result.rows.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          조 편성을 마치면 큐시트가 만들어집니다.
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
            총 {result.rows.length}경기 · {Object.entries(result.courtEnd).map(([c, t]) => `${c} 종료 ${t}`).join(" · ")}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr style={{ background: "var(--color-fg-paper-3)" }}>
                  {["시작", "종료", "구장", "조", "대진"].map((h) => (
                    <th key={h} className="border px-3 py-2 text-left text-xs font-black"
                        style={{ borderColor: "rgba(0,71,171,0.12)", color: "var(--primary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={`${r.court}-${r.order}`} style={{ background: i % 2 ? "rgba(13,27,42,0.02)" : "#fff" }}>
                    <td className="border px-3 py-2 font-bold" style={{ borderColor: "rgba(13,27,42,0.08)" }}>{r.start}</td>
                    <td className="border px-3 py-2" style={{ borderColor: "rgba(13,27,42,0.08)", color: "var(--color-fg-ink-muted)" }}>{r.end}</td>
                    <td className="border px-3 py-2" style={{ borderColor: "rgba(13,27,42,0.08)" }}>{r.court}</td>
                    <td className="border px-3 py-2" style={{ borderColor: "rgba(13,27,42,0.08)" }}>{r.groupName}조</td>
                    <td className="border px-3 py-2 font-bold" style={{ borderColor: "rgba(13,27,42,0.08)" }}>{r.home} vs {r.away}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
