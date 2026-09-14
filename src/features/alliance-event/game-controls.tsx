"use client";

import { useEffect, useRef, useState } from "react";
import { formatRecord, gameStandings, recordUnit, tiedGroups } from "./scoring";
import { pendingTurns, type EventTurn } from "./workflow";
import type { Command, EventState, Game } from "./types";
import styles from "./event.module.css";
import ui from "./operator.module.css";

type Send = (command: Command) => Promise<boolean>;
export function GameControls({
  state,
  send,
  busy,
  game,
  onNext,
}: {
  state: EventState;
  send: Send;
  busy: boolean;
  game: Game;
  onNext: () => void;
}) {
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    turn: EventTurn;
    value: number;
  } | null>(null);
  const [value, setValue] = useState("");
  const [editingTurn, setEditingTurn] = useState<EventTurn | null>(null);
  const [localError, setLocalError] = useState("");
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (timerStart === null) return;
    const timer = setInterval(
      () => setElapsed((performance.now() - timerStart) / 1000),
      50,
    );
    return () => clearInterval(timer);
  }, [timerStart]);
  const queue = pendingTurns(state, game);
  const turn =
    published?.turn ??
    editingTurn ??
    queue.find((t) => t.key === manualKey) ??
    queue[0];
  const staleTurn =
    editingTurn !== null && !queue.some((t) => t.key === editingTurn.key);
  const team = state.setup.teams.find((t) => t.id === turn?.teamId);
  const rows = gameStandings(state, game);
  const groups = tiedGroups(state, game);
  const ready = rows.every((r) => r.points !== null);
  const blocked = busy || !state.locked || state.finalized[game] || staleTurn;
  const gameName = game === "shooting" ? "슈팅왕" : "공 살리기";
  const regularDone = state.attempts.filter(
    (a) => !a.voided && !a.tieId && a.game === game,
  ).length;
  const max = game === "shooting" ? 24 : 12;
  function introduce(t: EventTurn) {
    return send({
      type: "show",
      scene: "prepare",
      game,
      teamId: t.teamId,
      slot: t.slot,
      pair: t.pair,
    });
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!turn || blocked || published) return;
    setLocalError("");
    if (!value.trim()) {
      setLocalError("측정한 숫자를 입력해주세요.");
      inputRef.current?.focus();
      return;
    }
    const measured = Number(value);
    if (
      await send({
        type: "record",
        game,
        teamId: turn.teamId,
        slot: turn.slot,
        value: measured,
        pair: turn.pair,
        tieId: turn.tieId,
      })
    ) {
      setPublished({ turn, value: measured });
      setValue("");
      setManualKey(null);
      setEditingTurn(null);
    }
  }
  async function nextTurn() {
    if (queue[0] && !(await introduce(queue[0]))) return;
    setPublished(null);
    setValue("");
    setManualKey(null);
    setLocalError("");
    setEditingTurn(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  return (
    <div>
      <div className={ui.intro}>
        <small>
          {game === "shooting"
            ? "2단계 · 보너스 게임 · 100점"
            : "3단계 · 본게임 · 1,000점"}
        </small>
        <h2 tabIndex={-1}>
          {state.finalized[game]
            ? `${gameName} 결과를 확정했습니다`
            : published
              ? "기록을 공개했습니다"
              : turn
                ? game === "shooting"
                  ? "속도를 입력하고 공개하세요"
                  : "공 살리기 기록을 입력하세요"
                : "모든 팀의 도전이 끝났습니다"}
        </h2>
        <p>
          {published
            ? `${state.setup.revealSeconds}초 후 팀별 기록순위로 바뀝니다. 준비되면 다음 차례로 진행하세요.`
            : turn
              ? "팀과 선수는 순서대로 안내합니다. 측정한 숫자만 입력하면 됩니다."
              : "기록을 확인하고 다음 단계로 넘어가세요."}
        </p>
      </div>
      <div className={ui.progress}>
        <progress
          value={regularDone}
          max={max}
          aria-label={`${gameName} 진행률`}
        />
        <span>
          {regularDone} / {max}회 완료
        </span>
      </div>
      {localError && (
        <p className={ui.error} role="alert">
          {localError}
        </p>
      )}
      {staleTurn && (
        <div className={ui.error} role="alert">
          이 차례의 기록이 다른 화면에서 변경됐습니다. 현재 입력을 비우고 다음
          차례를 확인해주세요.
          <button
            className={ui.quiet}
            disabled={busy}
            onClick={() => {
              setEditingTurn(null);
              setManualKey(null);
              setValue("");
              setTimerStart(null);
            }}
          >
            현재 입력 비우기
          </button>
        </div>
      )}
      {turn && team && !state.finalized[game] && (
        <>
          <section
            className={ui.turn}
            style={{ "--team-color": team.color } as React.CSSProperties}
          >
            <div className={ui.turnTop}>
              <span>{published ? "방금 도전한 팀" : "지금 도전할 팀"}</span>
              <b>
                {turn.tieId ? "동점 팀 재경기" : `${turn.round}차 도전 / 2회`}
              </b>
            </div>
            <h3>{team.name}</h3>
            <p>
              {game === "shooting"
                ? `${turn.slot === "male" ? "남자 대표" : "여자 대표"} · ${turn.slot ? team[turn.slot] : ""}`
                : "공 살리기 선수 6명"}
            </p>
          </section>
          {published ? (
            <>
              <p className={ui.status} role="status">
                {formatRecord(published.value, game, state.setup.metric)}{" "}
                {recordUnit(game, state.setup.metric)} · 저장하고 공개했습니다.
              </p>
              <button
                className={ui.next}
                disabled={busy}
                onClick={() => void nextTurn()}
              >
                {queue.length
                  ? game === "shooting"
                    ? "다음 선수 준비 →"
                    : "다음 팀 준비 →"
                  : "결과 확인 →"}
              </button>
            </>
          ) : (
            <form onSubmit={(e) => void publish(e)}>
              <label className={styles.recordInputLabel}>
                {game === "shooting"
                  ? "측정 속도"
                  : state.setup.metric === "seconds"
                    ? "공을 살린 시간"
                    : "연속 터치 횟수"}
                <div className={styles.recordInput}>
                  <input
                    ref={inputRef}
                    aria-label={
                      game === "shooting" ? "측정 속도" : "공 살리기 기록"
                    }
                    inputMode={
                      state.setup.metric === "touches" && game === "keepUp"
                        ? "numeric"
                        : "decimal"
                    }
                    placeholder={
                      game === "shooting"
                        ? "예: 95.2"
                        : state.setup.metric === "seconds"
                          ? "예: 32.50"
                          : "예: 24"
                    }
                    value={value}
                    autoComplete="off"
                    disabled={blocked || timerStart !== null}
                    onChange={(e) => {
                      setEditingTurn(turn);
                      setValue(e.target.value);
                    }}
                  />
                  <span>{recordUnit(game, state.setup.metric)}</span>
                </div>
              </label>
              {game === "keepUp" && state.setup.metric === "seconds" && (
                <div className={styles.stopwatch}>
                  <span>
                    {timerStart === null
                      ? "직접 입력하거나 여기서 시간을 재세요"
                      : `${elapsed.toFixed(2)}초`}
                  </span>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (timerStart === null) {
                        setElapsed(0);
                        setEditingTurn(turn);
                        setTimerStart(performance.now());
                      } else {
                        setValue(
                          ((performance.now() - timerStart) / 1000).toFixed(2),
                        );
                        setTimerStart(null);
                      }
                    }}
                  >
                    {timerStart === null ? "시간 재기" : "정지 · 입력하기"}
                  </button>
                </div>
              )}
              <button
                type="submit"
                className={styles.publishButton}
                disabled={blocked || timerStart !== null}
              >
                {busy ? "저장 중…" : "기록 공개하기"}
                <span>↗</span>
              </button>
            </form>
          )}
          {!published && (
            <details className={ui.extras}>
              <summary>다른 선수 선택 · 선수 안내 화면</summary>
              <div>
                <label>
                  입력할 차례
                  <select
                    aria-label="입력할 차례"
                    value={turn.key}
                    disabled={busy || timerStart !== null}
                    onChange={(e) => {
                      setManualKey(e.target.value);
                      setValue("");
                      setLocalError("");
                      setEditingTurn(null);
                    }}
                  >
                    {queue.map((t) => (
                      <option key={t.key} value={t.key}>
                        {
                          state.setup.teams.find(
                            (team) => team.id === t.teamId,
                          )!.name
                        }{" "}
                        ·{" "}
                        {t.slot === "male"
                          ? "남자"
                          : t.slot === "female"
                            ? "여자"
                            : "6인"}{" "}
                        · {t.round}차
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={() => void introduce(turn)}
                >
                  현재 선수 안내 화면 띄우기
                </button>
              </div>
            </details>
          )}
        </>
      )}
      {!turn && !state.finalized[game] && (
        <>
          {groups.map((ids) => (
            <div className={ui.error} key={ids.join()}>
              <p>
                {ids
                  .map((id) => state.setup.teams.find((t) => t.id === id)!.name)
                  .join(" · ")}{" "}
                기록이 같습니다.
              </p>
              <button
                className={styles.primaryButton}
                disabled={busy}
                onClick={() =>
                  void send({ type: "tiebreak", game, teamIds: ids })
                }
              >
                동점 팀 재경기 시작 →
              </button>
            </div>
          ))}
          {ready && (
            <button
              className={ui.next}
              disabled={busy}
              onClick={async () => {
                if (await send({ type: "finalize", game })) onNext();
              }}
            >
              {game === "shooting"
                ? "슈팅 결과 확정하고 공 살리기로 →"
                : "공 살리기 확정하고 우승 발표로 →"}
            </button>
          )}
        </>
      )}
      {state.finalized[game] && (
        <button className={ui.next} onClick={onNext}>
          다음 단계로 →
        </button>
      )}
      <details className={ui.extras} open={!turn}>
        <summary>
          전체 팀 기록 보기 · {rows.filter((r) => r.complete).length} / 6팀 완료
        </summary>
        <div className={styles.compactResults}>
          {rows.map((r) => (
            <div key={r.teamId}>
              <span>
                {state.setup.teams.find((t) => t.id === r.teamId)!.name}
              </span>
              <b>
                {formatRecord(r.value, game, state.setup.metric)}{" "}
                <small>{recordUnit(game, state.setup.metric)}</small>
              </b>
              <small>{r.tied ? "동점" : r.complete ? "완료" : "진행 중"}</small>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
