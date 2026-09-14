"use client";

import { useEffect, useRef, useState } from "react";
import { randomizeSetup } from "./pairing";
import { rosterIssue } from "./workflow";
import { validateSetup } from "./engine";
import type { AllianceTeam, Command, EventState, Setup } from "./types";
import styles from "./event.module.css";
import ui from "./operator.module.css";

export function SetupForm({
  state,
  send,
  busy,
  onStart,
}: {
  state: EventState;
  send: (c: Command, v?: number) => Promise<boolean>;
  busy: boolean;
  onStart: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(state.setup));
  const [savedSetup, setSavedSetup] = useState(() =>
    JSON.stringify(state.setup),
  );
  const [phase, setPhase] = useState(0);
  const [teamIndex, setTeamIndex] = useState(0);
  const [previousDraw, setPreviousDraw] = useState<Setup | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = formRef.current;
    if (!root || root.closest("[hidden]")) return;
    root.closest("section")?.scrollIntoView({ block: "start" });
    root.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [phase, teamIndex]);
  const dirty = !state.locked && JSON.stringify(draft) !== savedSetup;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const team = draft.teams[teamIndex];
  const sourceNames = (t: AllianceTeam) =>
    t.sourceIds
      .map((id) => draft.sources.find((s) => s.id === id)?.name ?? id)
      .join(" + ");
  const updateTeam = (patch: Partial<AllianceTeam>) =>
    setDraft({
      ...draft,
      teams: draft.teams.map((t, i) =>
        i === teamIndex ? { ...t, ...patch } : t,
      ),
    });
  const focusMissing = () =>
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')
        ?.focus(),
    );
  async function save(): Promise<boolean> {
    setError("");
    if (state.locked) return false;
    if (JSON.stringify(state.setup) !== savedSetup) {
      setError(
        "다른 운영 화면에서 편성이 바뀌었습니다. 아래의 ‘저장된 편성 불러오기’로 최신 편성을 확인해 주세요.",
      );
      return false;
    }
    try {
      validateSetup(draft, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "입력 내용을 확인해 주세요.");
      return false;
    }
    if (await send({ type: "setup", setup: draft }, state.version)) {
      setSavedSetup(JSON.stringify(draft));
      setPreviousDraw(null);
      setMessage("");
      return true;
    }
    return false;
  }
  async function next() {
    if (phase === 1) {
      const issue = rosterIssue(team);
      if (issue) {
        setError(issue);
        focusMissing();
        return;
      }
    }
    if (!(await save())) return;
    if (phase === 0) setPhase(1);
    else if (teamIndex < 5) setTeamIndex(teamIndex + 1);
    else setPhase(2);
  }
  async function start() {
    const missing = draft.teams.findIndex((t) => rosterIssue(t));
    if (missing !== -1) {
      setTeamIndex(missing);
      setPhase(1);
      setError(rosterIssue(draft.teams[missing])!);
      focusMissing();
      return;
    }
    if (await save()) {
      if (await send({ type: "lock" })) onStart();
    }
  }
  const teamCards = (editable: boolean) => (
    <div className={ui.pairs} aria-label="연합팀 배치 결과">
      {[0, 3, 1, 4, 2, 5].map((i) => {
        const t = draft.teams[i];
        return (
          <article
            key={t.id}
            className={ui.pairCard}
            style={{ "--team-color": t.color } as React.CSSProperties}
          >
            <small>{sourceNames(t)}</small>
            {editable ? (
              <label>
                {t.group}연합 {(i % 3) + 1} · 새 팀 이름
                <input
                  aria-label={`${t.group}연합 ${(i % 3) + 1} 이름`}
                  value={t.name}
                  maxLength={60}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      teams: draft.teams.map((row, n) =>
                        n === i ? { ...row, name: e.target.value } : row,
                      ),
                    })
                  }
                />
              </label>
            ) : (
              <strong>{t.name}</strong>
            )}
            {!editable && (
              <p className={styles.help}>
                {rosterIssue(t) ? "선수 입력 필요" : "선수 준비 완료"}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
  if (state.locked)
    return (
      <div>
        <div className={ui.intro}>
          <small>1단계 · 팀 준비 완료</small>
          <h2 tabIndex={-1}>6개 연합팀이 준비됐습니다</h2>
          <p>경기 중에는 편성을 바꿀 수 없습니다.</p>
        </div>
        {teamCards(false)}
        <div className={ui.footer}>
          <span />
          <button
            className={styles.primaryButton}
            disabled={busy}
            onClick={onStart}
          >
            경기 진행으로 →
          </button>
        </div>
      </div>
    );
  return (
    <div ref={formRef}>
      <div className={ui.intro}>
        <small>팀 준비 · {phase + 1} / 3</small>
        <h2 tabIndex={-1}>
          {phase === 0
            ? "팀을 묶고 이름을 정해주세요"
            : phase === 1
              ? "한 팀씩 선수를 입력해주세요"
              : "준비를 마치고 시작할까요?"}
        </h2>
        <p>
          {phase === 0
            ? "A조와 B조 안에서 두 팀씩 자동으로 묶었습니다. 새 연합팀 이름을 입력하세요."
            : phase === 1
              ? "슈팅왕 남녀 대표와 공 살리기 6명입니다. 다음 팀으로 가면 저장됩니다."
              : "슈팅왕 100점 + 공 살리기 1,000점. 시작하면 팀 편성이 확정됩니다."}
        </p>
      </div>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={ui.status} role="status">
          {message}
        </p>
      )}
      <fieldset disabled={busy}>
        {phase === 0 && (
          <>
            <details className={ui.extras}>
              <summary>원래 참가팀 이름 바꾸기 · A조 6팀 / B조 6팀</summary>
              <div className={styles.sourceGrid}>
                {draft.sources.map((source, i) => (
                  <label key={source.id}>
                    {source.id}
                    <input
                      maxLength={60}
                      value={source.name}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          sources: draft.sources.map((s, n) =>
                            n === i ? { ...s, name: e.target.value } : s,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <div className={ui.section}>{teamCards(true)}</div>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => {
                setPreviousDraw(structuredClone(draft));
                setDraft(randomizeSetup(draft));
                setError("");
                setMessage(
                  "다시 추첨했습니다. 바뀐 연합팀의 선수는 다시 입력해 주세요.",
                );
              }}
            >
              다시 랜덤으로 묶기
            </button>
            {previousDraw && (
              <button
                type="button"
                className={ui.quiet}
                onClick={() => {
                  setDraft(previousDraw);
                  setPreviousDraw(null);
                  setMessage("추첨 전 편성으로 되돌렸습니다.");
                }}
              >
                추첨 되돌리기
              </button>
            )}
            <details className={ui.extras}>
              <summary>
                경기 설정 ·{" "}
                {draft.metric === "seconds" ? "시간으로 측정" : "횟수로 측정"} /{" "}
                {draft.revealSeconds}초 후 비교
              </summary>
              <div className={ui.fieldGrid}>
                <label>
                  행사 이름
                  <input
                    value={draft.title}
                    maxLength={60}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  공 살리기 측정 방법
                  <select
                    value={draft.metric}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        metric: e.target.value as "seconds" | "touches",
                      })
                    }
                  >
                    <option value="seconds">시간 · 초</option>
                    <option value="touches">터치 횟수 · 회</option>
                  </select>
                </label>
                <label>
                  기록을 크게 보여주는 시간
                  <select
                    value={draft.revealSeconds}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        revealSeconds: Number(e.target.value),
                      })
                    }
                  >
                    {[2, 3, 4, 5, 6, 8, 10, 15].map((s) => (
                      <option key={s} value={s}>
                        {s}초
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          </>
        )}
        {phase === 1 && (
          <>
            <nav className={ui.teamPicker} aria-label="선수 입력할 연합팀">
              {draft.teams.map((t, i) => (
                <button
                  type="button"
                  key={t.id}
                  aria-label={`${t.name} 선수 입력`}
                  aria-current={teamIndex === i ? "step" : undefined}
                  onClick={async () => {
                    if (await save()) setTeamIndex(i);
                  }}
                >
                  {!rosterIssue(t) ? "✓ " : ""}
                  {t.group}
                  {(i % 3) + 1}
                </button>
              ))}
            </nav>
            <div
              className={ui.teamTitle}
              style={{ "--team-color": team.color } as React.CSSProperties}
            >
              <p>
                {teamIndex + 1} / 6팀 · {sourceNames(team)}
              </p>
              <h3>{team.name}</h3>
            </div>
            <section className={ui.section}>
              <h3>슈팅왕 · 남자 1명, 여자 1명</h3>
              <div className={ui.fieldGrid}>
                {(["male", "female"] as const).map((slot) => (
                  <label key={slot}>
                    {slot === "male" ? "남자 대표" : "여자 대표"}
                    <input
                      value={team[slot]}
                      maxLength={60}
                      placeholder="선수 이름"
                      aria-invalid={Boolean(error) && !team[slot].trim()}
                      aria-describedby={error ? "roster-help" : undefined}
                      onChange={(e) => updateTeam({ [slot]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className={ui.section}>
              <h3>공 살리기 · 6명</h3>
              <div className={ui.fieldGrid}>
                {team.keepUpPlayers.map((name, i) => (
                  <label key={i}>
                    선수 {i + 1}
                    <input
                      value={name}
                      maxLength={60}
                      placeholder="선수 이름"
                      aria-invalid={Boolean(error) && !name.trim()}
                      aria-describedby={error ? "roster-help" : undefined}
                      onChange={(e) =>
                        updateTeam({
                          keepUpPlayers: team.keepUpPlayers.map((p, n) =>
                            n === i ? e.target.value : p,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className={styles.help} id="roster-help">
                동명이인은 이름 뒤에 등번호를 적어 구분해주세요.
              </p>
            </section>
          </>
        )}
        {phase === 2 && teamCards(false)}
        <div className={ui.footer}>
          {phase > 0 ? (
            <button
              type="button"
              className={ui.quiet}
              onClick={async () => {
                if (await save()) {
                  if (phase === 2) setPhase(1);
                  else if (teamIndex > 0) setTeamIndex(teamIndex - 1);
                  else setPhase(0);
                }
              }}
            >
              ← 이전으로
            </button>
          ) : (
            <span className={styles.help}>다음으로 가면 저장됩니다.</span>
          )}
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => void (phase === 2 ? start() : next())}
          >
            {busy
              ? "저장 중…"
              : phase === 0
                ? "이 편성으로 선수 입력 →"
                : phase === 1
                  ? teamIndex < 5
                    ? "저장하고 다음 팀 →"
                    : "저장하고 준비 확인 →"
                  : "준비 완료 · 슈팅왕 시작 →"}
          </button>
        </div>
      </fieldset>
      {error && (
        <button
          className={ui.quiet}
          disabled={busy}
          onClick={() => {
            setDraft(structuredClone(state.setup));
            setSavedSetup(JSON.stringify(state.setup));
            setPreviousDraw(null);
            setError("");
            setMessage("저장된 편성을 불러왔습니다.");
          }}
        >
          저장된 편성 불러오기
        </button>
      )}
    </div>
  );
}
