"use client";

import { useState } from "react";
import type { Command, EventState, Setup } from "./types";
import { randomizeSetup } from "./pairing";
import styles from "./event.module.css";

export function SetupForm({
  state,
  send,
  busy,
}: {
  state: EventState;
  send: (c: Command, v?: number) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(() => structuredClone(state.setup));
  const [baseVersion, setBaseVersion] = useState(state.version);
  const [message, setMessage] = useState("");
  const [previousDraw, setPreviousDraw] = useState<Setup | null>(null);
  const [drawMessage, setDrawMessage] = useState("");
  function drawTeams() {
    if (state.locked || busy) return;
    const next = randomizeSetup(draft);
    setPreviousDraw(structuredClone(draft));
    setDraft(next);
    setMessage("");
    setDrawMessage(
      "6개 연합팀을 무작위로 배치했습니다. 결과를 확인하고 편성을 저장해 주세요.",
    );
  }
  async function save(lock = false) {
    if (await send({ type: "setup", setup: draft }, baseVersion)) {
      setBaseVersion(baseVersion + 1);
      setMessage("편성을 저장했습니다.");
      setPreviousDraw(null);
      setDrawMessage(
        "편성을 저장했습니다. 새로고침해도 같은 배치로 유지됩니다.",
      );
      if (lock) await send({ type: "lock" });
    }
  }
  return (
    <div className={styles.setupForm}>
      <div className={styles.sectionHeading}>
        <div>
          <span>01 / TEAM SETUP</span>
          <h2>여섯 개의 새로운 팀</h2>
        </div>
        <b>{state.locked ? "편성 확정" : "경기 전 준비"}</b>
      </div>
      <p className={styles.help}>
        같은 조의 두 팀을 묶고 새 이름을 지어주세요. 남녀 슈팅 대표와 공 살리기
        출전자 6명을 입력한 뒤 편성을 확정합니다.
      </p>
      <fieldset disabled={state.locked || busy}>
        <section className={styles.drawPanel} aria-label="랜덤 팀 편성">
          <div className={styles.drawHeading}>
            <div>
              <span>A조 6팀 + B조 6팀</span>
              <h3>같은 조에서 둘씩, 랜덤 자동 배치</h3>
            </div>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={drawTeams}
            >
              ↻ 랜덤 자동 배치
            </button>
          </div>
          <p className={styles.help}>
            A조와 B조에서 각각 3개 연합팀을 만듭니다. 팀 이름은 유지하고,
            구성팀이 바뀐 연합팀의 출전자 명단은 비웁니다.
          </p>
          <div className={styles.drawSummary} aria-label="연합팀 배치 결과">
            {draft.teams.map((team, index) => (
              <div
                key={team.id}
                style={{ "--team-color": team.color } as React.CSSProperties}
              >
                <b>
                  {team.group}
                  {(index % 3) + 1}
                </b>
                <div>
                  <strong>{team.name}</strong>
                  <span>
                    {team.sourceIds
                      .map(
                        (id) =>
                          draft.sources.find((s) => s.id === id)?.name ?? id,
                      )
                      .join(" + ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {!state.locked && (
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => void save()}
            >
              배치 저장
            </button>
          )}
          {!state.locked && previousDraw && (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => {
                setDraft(previousDraw);
                setPreviousDraw(null);
                setMessage("");
                setDrawMessage(
                  "추첨 전 편성과 명단으로 되돌렸습니다. 편성 저장을 눌러 적용해 주세요.",
                );
              }}
            >
              이전 편성으로 되돌리기
            </button>
          )}
          {drawMessage && (
            <p className={styles.help} role="status">
              {drawMessage}
            </p>
          )}
          <p className={styles.help}>
            {state.locked
              ? "편성 확정 후에는 다시 추첨할 수 없습니다."
              : "결과 확인 → 편성 저장 → 출전자 입력 → 편성 확정"}
          </p>
        </section>
        <div className={styles.formGrid}>
          <label className={styles.wideField}>
            이벤트명
            <input
              value={draft.title}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            공 살리기 기록 기준
            <select
              value={draft.metric}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  metric: e.target.value as "seconds" | "touches",
                })
              }
            >
              <option value="seconds">유지 시간 · 초</option>
              <option value="touches">연속 터치 · 회</option>
            </select>
          </label>
          <label>
            기록 공개 시간
            <select
              value={draft.revealSeconds}
              onChange={(e) =>
                setDraft({ ...draft, revealSeconds: Number(e.target.value) })
              }
            >
              {[2, 3, 4, 5, 6, 8, 10, 15].map((s) => (
                <option key={s} value={s}>
                  {s}초 후 양 팀 비교
                </option>
              ))}
            </select>
          </label>
        </div>
        <details className={styles.details}>
          <summary>원 참가팀 이름 · A조 6팀 / B조 6팀</summary>
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
        {draft.teams.map((team, index) => {
          const update = (patch: Partial<typeof team>) =>
            setDraft({
              ...draft,
              teams: draft.teams.map((t, i) =>
                i === index ? { ...t, ...patch } : t,
              ),
            });
          return (
            <article
              key={team.id}
              className={styles.setupTeam}
              style={{ "--team-color": team.color } as React.CSSProperties}
            >
              <div className={styles.setupTeamHeading}>
                <b>
                  {team.group}
                  {(index % 3) + 1}
                </b>
                <label>
                  연합팀 이름
                  <input
                    value={team.name}
                    maxLength={60}
                    onChange={(e) => update({ name: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.formGrid}>
                {([0, 1] as const).map((slot) => (
                  <label key={slot}>
                    구성팀 {slot + 1}
                    <select
                      value={team.sourceIds[slot]}
                      onChange={(e) => {
                        const sourceIds = [...team.sourceIds] as [
                          string,
                          string,
                        ];
                        sourceIds[slot] = e.target.value;
                        update({ sourceIds });
                      }}
                    >
                      {draft.sources
                        .filter((s) => s.group === team.group)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
                <label>
                  슈팅왕 · 남자 대표
                  <input
                    placeholder="선수 이름"
                    maxLength={60}
                    value={team.male}
                    onChange={(e) => update({ male: e.target.value })}
                  />
                </label>
                <label>
                  슈팅왕 · 여자 대표
                  <input
                    placeholder="선수 이름"
                    maxLength={60}
                    value={team.female}
                    onChange={(e) => update({ female: e.target.value })}
                  />
                </label>
              </div>
              <details className={styles.rosterDetails}>
                <summary>
                  공 살리기 출전자{" "}
                  <b>{team.keepUpPlayers.filter((p) => p.trim()).length} / 6</b>
                </summary>
                <div className={styles.rosterGrid}>
                  {team.keepUpPlayers.map((name, p) => (
                    <label key={p}>
                      선수 {p + 1}
                      <input
                        maxLength={60}
                        placeholder={p < 3 ? "구성팀 1 선수" : "구성팀 2 선수"}
                        value={name}
                        onChange={(e) =>
                          update({
                            keepUpPlayers: team.keepUpPlayers.map((v, n) =>
                              n === p ? e.target.value : v,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </fieldset>
      {state.locked ? (
        <p className={styles.success}>
          팀 편성과 규칙이 확정되었습니다. 경기 진행 탭에서 기록을 공개해
          주세요.
        </p>
      ) : (
        <>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => void save()}
            >
              편성 저장
            </button>
            <button
              className={styles.primaryButton}
              disabled={busy}
              onClick={() => void save(true)}
            >
              저장하고 편성 확정 →
            </button>
          </div>
          <button
            className={styles.textButton}
            disabled={busy}
            onClick={() => {
              setDraft(structuredClone(state.setup));
              setBaseVersion(state.version);
              setMessage("저장된 편성을 불러왔습니다.");
              setPreviousDraw(null);
              setDrawMessage("");
            }}
          >
            서버에 저장된 편성 다시 불러오기
          </button>
          <p className={styles.help}>
            확정 후에는 팀·출전자·기록 기준이 잠깁니다. 동명이인 출전자는
            등번호를 함께 입력해 구분해 주세요.
          </p>
        </>
      )}
      {message && (
        <p className={styles.help} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
