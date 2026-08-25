"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Gauge,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from "lucide-react";
import { AdminGuard } from "@/components/admin-guard";
import { AdminPanel, AdminShell, AdminStatusPill } from "@/components/admin-shell";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";
import {
  SKILL_CHALLENGE_DATE_LABEL,
  SKILL_CHALLENGE_EVENT_DATES,
  SKILL_CHALLENGE_EVENT_NAME,
  SKILL_CHALLENGE_LOCATION_LABEL,
  getSkillChallengeAwards,
} from "@/lib/skill-challenge";
import {
  exportSkillChallengeCsv,
  fetchSkillChallengeParticipants,
  filterSkillChallengeParticipants,
  getPreviewSkillChallengeScore,
  getSkillChallengeProgressCount,
  isSkillChallengeRecordComplete,
  saveSkillChallengeRecord,
  type SkillChallengeAdminRecord,
  type SkillChallengeParticipant,
} from "@/lib/skill-challenge-admin";

interface RecordFormState {
  eventDate: string;
  speedKmh: string;
  targetAttemptCount: string;
  targetRecorded: boolean;
  targetHit: boolean;
  airTouchScore: string;
  memo: string;
}

const DEFAULT_EVENT_DATE = SKILL_CHALLENGE_EVENT_DATES[0]?.value ?? "2026-08-07";
const DEFAULT_FORM: RecordFormState = {
  eventDate: DEFAULT_EVENT_DATE,
  speedKmh: "",
  targetAttemptCount: "3",
  targetRecorded: false,
  targetHit: false,
  airTouchScore: "",
  memo: "",
};

const TARGET_RESULT_OPTIONS: Array<{ label: string; attemptCount: number | null }> = [
  { label: "3/3", attemptCount: 3 },
  { label: "3/4", attemptCount: 4 },
  { label: "3/5", attemptCount: 5 },
  { label: "실패", attemptCount: null },
];

const inputStyle: React.CSSProperties = {
  background: "#fff",
  borderColor: "rgba(13,27,42,0.16)",
  color: "var(--color-fg-ink)",
};

const redButtonStyle: React.CSSProperties = {
  background: "var(--destructive)",
  color: "#fff",
  boxShadow: "0 16px 32px rgba(255,59,48,0.20)",
};

export default function AdminSkillChallengePage() {
  return (
    <AdminGuard allow={["admin"]}>
      <AdminSkillChallenge />
    </AdminGuard>
  );
}

function AdminSkillChallenge() {
  const [participants, setParticipants] = useState<SkillChallengeParticipant[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState<RecordFormState>(DEFAULT_FORM);
  const loadingParticipantsRef = useRef(false);

  const loadParticipants = useCallback(async (options?: { silent?: boolean }) => {
    if (loadingParticipantsRef.current) return;
    loadingParticipantsRef.current = true;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const list = await fetchSkillChallengeParticipants();
      setParticipants(list);
      setSelectedPlayerId((current) => {
        if (current && list.some((entry) => entry.player.id === current)) return current;
        return list[0]?.player.id ?? "";
      });
    } catch (error) {
      if (!silent) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "참가자 목록을 불러오지 못했습니다." });
      }
    } finally {
      loadingParticipantsRef.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadParticipants();
    });
    const intervalId = window.setInterval(() => {
      void loadParticipants({ silent: true });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [loadParticipants]);

  const selectedParticipant = useMemo(
    () => participants.find((entry) => entry.player.id === selectedPlayerId),
    [participants, selectedPlayerId],
  );

  useEffect(() => {
    const record = selectedParticipant?.record;
    if (!record) {
      setForm(DEFAULT_FORM);
      return;
    }

    setForm({
      eventDate: record.eventDate || DEFAULT_EVENT_DATE,
      speedKmh: record.speedKmh ? String(record.speedKmh) : "",
      targetAttemptCount: record.targetAttemptCount ? String(Math.max(3, Math.min(5, record.targetAttemptCount))) : "3",
      targetRecorded: record.targetRecorded || record.targetHit,
      targetHit: record.targetHit,
      airTouchScore: record.airTouchScore ? String(record.airTouchScore) : "",
      memo: record.memo ?? "",
    });
  }, [selectedParticipant?.player.id, selectedParticipant?.record]);

  const filteredParticipants = useMemo(
    () => filterSkillChallengeParticipants(participants, query),
    [participants, query],
  );

  const records = useMemo(
    () => participants.flatMap((entry) => (entry.record ? [entry.record] : [])),
    [participants],
  );

  const stats = useMemo(() => {
    const completed = records.filter((record) => isSkillChallengeRecordComplete(record)).length;
    const topScore = records.reduce((max, record) => Math.max(max, record.totalScore), 0);
    return {
      total: participants.length,
      recorded: records.length,
      completed,
      waiting: Math.max(0, participants.length - completed),
      topScore,
    };
  }, [participants.length, records]);

  const previewInput = useMemo(
    () => ({
      speedKmh: toNumber(form.speedKmh),
      targetRecorded: form.targetRecorded || form.targetHit,
      targetHit: form.targetHit,
      targetAttemptCount: getTargetAttemptCount(form),
      airTouchScore: toNumber(form.airTouchScore),
    }),
    [form],
  );
  const previewScore = getPreviewSkillChallengeScore(previewInput);
  const previewAwards = getSkillChallengeAwards(previewInput);

  const handleSave = async () => {
    if (!selectedParticipant || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveSkillChallengeRecord({
        playerId: selectedParticipant.player.id,
        eventDate: form.eventDate,
        speedKmh: previewInput.speedKmh,
        targetAttemptCount: previewInput.targetAttemptCount,
        targetRecorded: previewInput.targetRecorded,
        targetHit: form.targetHit,
        airTouchScore: previewInput.airTouchScore,
        memo: form.memo,
      });

      setParticipants((prev) =>
        prev.map((entry) =>
          entry.player.id === selectedParticipant.player.id
            ? { ...entry, record: saved }
            : entry,
        ),
      );
      setMessage({ tone: "success", text: `${selectedParticipant.player.name} 기록을 저장했습니다.` });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "기록 저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (records.length === 0) return;
    const blob = new Blob([exportSkillChallengeCsv(records)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ground-challenge-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      eyebrow="MANGSANG EVENT OPS"
      title="그라운드 챌린지"
      description={`${SKILL_CHALLENGE_EVENT_NAME} 가입자의 3종 챌린지 기록을 입력하고 선수카드 이벤트 뱃지를 지급합니다.`}
      aside={
        <div
          className="border p-5"
          style={{
            background: "rgba(255,255,255,0.86)",
            borderColor: "rgba(13,27,42,0.14)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div className="fg-label text-[10px]" style={{ color: "var(--destructive)" }}>EVENT</div>
          <div className="mt-2 fg-display text-3xl font-black" style={{ color: "var(--color-fg-ink)" }}>
            {SKILL_CHALLENGE_DATE_LABEL}
          </div>
          <div className="mt-3 text-sm font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
            {SKILL_CHALLENGE_LOCATION_LABEL}
          </div>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile icon={<UserRound />} label="가입자" value={stats.total} />
        <MetricTile icon={<Gauge />} label="기록 있음" value={stats.recorded} />
        <MetricTile icon={<Trophy />} label="3종 완료" value={stats.completed} />
        <MetricTile icon={<Sparkles />} label="최고 점수" value={stats.topScore} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <AdminPanel className="overflow-hidden">
          <div className="border-b p-4" style={{ borderColor: "rgba(13,27,42,0.12)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="fg-label text-[10px]" style={{ color: "var(--destructive)" }}>PARTICIPANTS</div>
                <div className="mt-1 text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
                  홀로그램 카드 가입자
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadParticipants()}
                disabled={loading}
                className="inline-flex h-10 w-10 items-center justify-center border transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                style={inputStyle}
                aria-label="참가자 새로고침"
                title="참가자 새로고침"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-4 flex min-h-[44px] items-center gap-2 border px-3" style={inputStyle}>
              <Search className="h-4 w-4" style={{ color: "var(--color-fg-ink-muted)" }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이름, 번호, 전화번호"
                className="h-10 flex-1 bg-transparent text-sm font-semibold outline-none"
                style={{ color: "var(--color-fg-ink)" }}
              />
            </div>
          </div>

          <div className="max-h-[640px] overflow-y-auto">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center text-sm font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                불러오는 중
              </div>
            ) : filteredParticipants.length > 0 ? (
              <div className="divide-y" style={{ borderColor: "rgba(13,27,42,0.10)" }}>
                {filteredParticipants.map((participant) => (
                  <ParticipantButton
                    key={participant.player.id}
                    participant={participant}
                    selected={participant.player.id === selectedPlayerId}
                    onSelect={() => setSelectedPlayerId(participant.player.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-sm font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
                표시할 참가자가 없습니다
              </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel className="overflow-hidden">
          <div className="border-b p-4 md:p-5" style={{ borderColor: "rgba(13,27,42,0.12)" }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="fg-label text-[10px]" style={{ color: "var(--destructive)" }}>RECORD ENTRY</div>
                <h2 className="mt-1 fg-display text-2xl font-black" style={{ color: "var(--color-fg-ink)" }}>
                  {selectedParticipant?.player.name ?? "참가자 선택"}
                </h2>
                {selectedParticipant && (
                  <div className="mt-1 text-xs font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
                    #{selectedParticipant.player.number || "-"} · {selectedParticipant.player.position}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={records.length === 0}
                  className="inline-flex min-h-[42px] items-center gap-2 border px-3 text-sm font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  style={inputStyle}
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!selectedParticipant || saving}
                  className="inline-flex min-h-[42px] items-center gap-2 px-4 text-sm font-bold transition-opacity disabled:cursor-wait disabled:opacity-60"
                  style={redButtonStyle}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  기록 저장
                </button>
              </div>
            </div>
            {message && (
              <div
                role="status"
                className="mt-4 border px-3 py-2 text-sm font-bold"
                style={{
                  background: message.tone === "success" ? "rgba(13,27,42,0.04)" : "rgba(255,59,48,0.08)",
                  borderColor: message.tone === "success" ? "rgba(13,27,42,0.12)" : "rgba(255,59,48,0.22)",
                  color: message.tone === "success" ? "var(--color-fg-ink)" : "var(--destructive)",
                }}
              >
                {message.text}
              </div>
            )}
          </div>

          {selectedParticipant ? (
            <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
              <div className="p-4 md:p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <FieldBlock icon={<Gauge />} title="슈팅 스피드">
                    <NumberInput
                      label="km/h"
                      value={form.speedKmh}
                      min={0}
                      max={130}
                      step={0.1}
                      onChange={(value) => setForm((prev) => ({ ...prev, speedKmh: value }))}
                    />
                  </FieldBlock>

                  <FieldBlock icon={<Target />} title="타겟 슈팅">
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                      총 5번 안에 타겟을 3회 성공했는지 기록합니다.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {TARGET_RESULT_OPTIONS.map((option) => (
                        <ToggleButton
                          key={option.label}
                          active={option.attemptCount === null
                            ? form.targetRecorded && !form.targetHit
                            : form.targetHit && form.targetAttemptCount === String(option.attemptCount)}
                          label={option.label}
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            targetRecorded: true,
                            targetHit: option.attemptCount !== null,
                            targetAttemptCount: option.attemptCount === null ? "" : String(option.attemptCount),
                          }))}
                        />
                      ))}
                    </div>
                  </FieldBlock>

                  <FieldBlock icon={<Sparkles />} title="에어볼 터치">
                    <NumberInput
                      label="합계 점수"
                      value={form.airTouchScore}
                      min={0}
                      step={0.1}
                      onChange={(value) => setForm((prev) => ({ ...prev, airTouchScore: value }))}
                    />
                  </FieldBlock>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="block text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
                      이벤트 날짜
                    </label>
                    <select
                      value={form.eventDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))}
                      className="mt-2 min-h-[44px] w-full border px-3 text-sm font-black"
                      style={inputStyle}
                    >
                      {SKILL_CHALLENGE_EVENT_DATES.map((date) => (
                        <option key={date.value} value={date.value}>{date.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
                      메모
                    </label>
                    <textarea
                      value={form.memo}
                      onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                      className="mt-2 min-h-[92px] w-full resize-y border p-3 text-sm font-semibold outline-none"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <aside className="border-t p-4 lg:border-l lg:border-t-0 md:p-5" style={{ borderColor: "rgba(13,27,42,0.12)", background: "rgba(13,27,42,0.025)" }}>
                <div className="flex items-center gap-3">
                  <PlayerProfilePhoto src={getPlayerProfilePhotoUrl(selectedParticipant.player)} alt={selectedParticipant.player.name} />
                  <div className="min-w-0">
                    <div className="truncate fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>
                      {selectedParticipant.player.name}
                    </div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {getProgressLabel(selectedParticipant.record)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border p-4" style={{ background: "#fff", borderColor: "rgba(13,27,42,0.12)" }}>
                  <div className="fg-label text-[10px]" style={{ color: "var(--destructive)" }}>SCORE</div>
                  <div className="mt-2 fg-display text-5xl font-black tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
                    {previewScore}
                  </div>
                  <div className="mt-2 text-xs font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
                    저장 후 랭킹과 뱃지에 반영
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>
                    지급 예정
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewAwards.eventBadges.map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex min-h-[30px] items-center border px-2.5 text-xs font-black"
                        style={{ background: "#fff", borderColor: "rgba(255,59,48,0.20)", color: "var(--destructive)" }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                  마지막 저장: {formatSavedAt(selectedParticipant.record)}
                </div>
              </aside>
            </div>
          ) : (
            <div className="p-12 text-center text-sm font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
              기록할 참가자를 선택하세요
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div
      className="border p-4"
      style={{
        background: "rgba(255,255,255,0.86)",
        borderColor: "rgba(13,27,42,0.12)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</div>
        <div className="[&>svg]:h-4 [&>svg]:w-4" style={{ color: "var(--destructive)" }}>{icon}</div>
      </div>
      <div className="mt-3 fg-display text-3xl font-black tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
        {value}
      </div>
    </div>
  );
}

function ParticipantButton({
  participant,
  selected,
  onSelect,
}: {
  participant: SkillChallengeParticipant;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = getRecordStatus(participant.record);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors"
      style={{ background: selected ? "rgba(255,59,48,0.08)" : "transparent" }}
    >
      <PlayerProfilePhoto src={getPlayerProfilePhotoUrl(participant.player)} alt={participant.player.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
          {participant.player.name}
        </div>
        <div className="mt-1 text-xs font-semibold" style={{ color: "var(--color-fg-ink-muted)" }}>
          #{participant.player.number || "-"} · {participant.player.position} · {getProgressLabel(participant.record)}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <AdminStatusPill tone={status.tone}>{status.label}</AdminStatusPill>
        <span className="text-xs font-black tabular-nums" style={{ color: "var(--color-fg-ink)" }}>
          {participant.record?.totalScore ?? 0}
        </span>
      </div>
    </button>
  );
}

function FieldBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border p-4" style={{ borderColor: "rgba(13,27,42,0.12)", background: "rgba(255,255,255,0.78)" }}>
      <div className="mb-4 flex items-center gap-2">
        <span className="[&>svg]:h-4 [&>svg]:w-4" style={{ color: "var(--destructive)" }}>{icon}</span>
        <h3 className="text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max?: number;
  step: number;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="block text-xs font-bold" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[52px] w-full border px-3 text-2xl font-black tabular-nums outline-none"
        style={inputStyle}
      />
    </>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[40px] border px-3 text-sm font-black transition-transform hover:-translate-y-0.5"
      style={{
        background: active ? "var(--destructive)" : "#fff",
        borderColor: active ? "var(--destructive)" : "rgba(13,27,42,0.16)",
        color: active ? "#fff" : "var(--color-fg-ink)",
      }}
    >
      {label}
    </button>
  );
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTargetAttemptCount(form: RecordFormState) {
  if (!form.targetHit) return null;
  const value = toNumber(form.targetAttemptCount) || 3;
  return Math.round(Math.max(3, Math.min(5, value)));
}

function getRecordStatus(record?: SkillChallengeAdminRecord): { label: string; tone: "blue" | "red" | "muted" } {
  if (isSkillChallengeRecordComplete(record)) return { label: "완료", tone: "blue" };
  if (record) return { label: "기록 중", tone: "red" };
  return { label: "대기", tone: "muted" };
}

function getProgressLabel(record?: SkillChallengeAdminRecord) {
  return `${getSkillChallengeProgressCount(record)}/3`;
}

function formatSavedAt(record?: SkillChallengeAdminRecord) {
  const value = record?.updatedAt ?? (record?.createdAt ? new Date(record.createdAt).toISOString() : "");
  if (!value) return "미저장";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
