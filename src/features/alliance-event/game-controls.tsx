"use client";

import { useEffect, useState } from "react";
import {
  formatRecord,
  gameStandings,
  recordUnit,
  tiedGroups,
  tieComplete,
} from "./scoring";
import type { Command, EventState, Game, Scene, Slot } from "./types";
import styles from "./event.module.css";

type Send = (command: Command) => Promise<boolean>;

export function GameControls({
  state,
  send,
  busy,
}: {
  state: EventState;
  send: Send;
  busy: boolean;
}) {
  const [game, setGame] = useState<Game>("shooting");
  const [pair, setPair] = useState([
    state.setup.teams[0].id,
    state.setup.teams[3].id,
  ]);
  const [teamId, setTeamId] = useState(pair[0]);
  const [slot, setSlot] = useState<Slot>("male");
  const [value, setValue] = useState("");
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (timerStart === null) return;
    const timer = setInterval(
      () => setElapsed(Math.max(0, (performance.now() - timerStart) / 1000)),
      50,
    );
    return () => clearInterval(timer);
  }, [timerStart]);
  const [localError, setLocalError] = useState("");
  const activeTie = state.ties.find(
    (t) => t.game === game && !tieComplete(state, t),
  );
  const selectedTeam = state.setup.teams.find((t) => t.id === teamId)!;
  const completed = state.attempts.filter(
    (a) =>
      !a.voided &&
      a.game === game &&
      a.teamId === teamId &&
      a.tieId === (activeTie?.id ?? null) &&
      (game === "keepUp" || a.slot === slot),
  ).length;
  const allowed = activeTie ? 1 : 2;
  const rows = gameStandings(state, game);
  const groups = tiedGroups(state, game);
  const ready = rows.every((r) => r.points !== null);
  const blocked = busy || !state.locked;

  function selectTeam(id: string) {
    setTeamId(id);
    if (!pair.includes(id))
      setPair([
        id,
        pair.find((v) => v !== id) ??
          state.setup.teams.find((t) => t.id !== id)!.id,
      ]);
  }
  function show(scene: Scene, id = teamId, playerSlot = slot, ids = pair) {
    return send({
      type: "show",
      scene,
      game,
      pair: ids,
      teamId: id,
      slot: game === "shooting" ? playerSlot : undefined,
    });
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setLocalError("");
    if (!value.trim()) {
      setLocalError("측정한 기록을 먼저 입력해 주세요.");
      return;
    }
    if (
      await send({
        type: "record",
        game,
        teamId,
        slot: game === "shooting" ? slot : undefined,
        value: Number(value),
        pair,
        tieId: activeTie?.id,
      })
    )
      setValue("");
  }
  async function nextTurn() {
    const pairs = activeTie
      ? [activeTie.teamIds]
      : [
          pair,
          ...[0, 1, 2].map((i) => [
            state.setup.teams[i].id,
            state.setup.teams[i + 3].id,
          ]),
        ];
    for (const ids of pairs) {
      for (let round = 1; round <= allowed; round++)
        for (const s of game === "shooting"
          ? (["male", "female"] as const)
          : (["male"] as const))
          for (const id of ids) {
            const count = state.attempts.filter(
              (a) =>
                !a.voided &&
                a.game === game &&
                a.teamId === id &&
                a.tieId === (activeTie?.id ?? null) &&
                (game === "keepUp" || a.slot === s),
            ).length;
            if (count < round) {
              const nextPair =
                ids.length === 2
                  ? ids
                  : [id, ids.find((other) => other !== id)!];
              setPair(nextPair);
              setTeamId(id);
              setSlot(s);
              setValue("");
              await show("prepare", id, s, nextPair);
              return;
            }
          }
    }
    setLocalError(
      "정해진 시도를 모두 마쳤습니다. 아래에서 기록과 순위를 확인해 주세요.",
    );
  }

  return (
    <div>
      <div className={styles.sectionHeading}>
        <div>
          <span>02 / GAME CONTROL</span>
          <h2>기록을 입력하고, 공개하세요</h2>
        </div>
      </div>
      <div className={styles.gameTabs}>
        <button
          className={game === "shooting" ? styles.gameActive : ""}
          onClick={() => {
            setGame("shooting");
            setValue("");
            setTimerStart(null);
          }}
        >
          <small>BONUS GAME · 100점</small>슈팅왕
        </button>
        <button
          className={game === "keepUp" ? styles.gameActive : ""}
          onClick={() => {
            setGame("keepUp");
            setValue("");
          }}
        >
          <small>MAIN EVENT · 1,000점</small>공 살리기
        </button>
      </div>
      {!state.locked && (
        <p className={styles.notice}>
          팀 편성 탭에서 출전 명단을 입력하고 편성을 확정해 주세요.
        </p>
      )}
      <div className={styles.panel}>
        <div className={styles.formGrid}>
          {([0, 1] as const).map((side) => (
            <label key={side}>
              비교 화면 · {side === 0 ? "왼쪽" : "오른쪽"} 팀
              <select
                value={pair[side]}
                onChange={(e) => {
                  const ids = [...pair];
                  ids[side] = e.target.value;
                  setPair(ids);
                  if (!ids.includes(teamId)) setTeamId(ids[0]);
                }}
              >
                {state.setup.teams.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={t.id === pair[1 - side]}
                  >
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className={styles.formGrid}>
          <label>
            지금 도전하는 연합팀
            <select value={teamId} onChange={(e) => selectTeam(e.target.value)}>
              {(activeTie ? activeTie.teamIds : pair).map((id) => (
                <option key={id} value={id}>
                  {state.setup.teams.find((t) => t.id === id)!.name}
                </option>
              ))}
            </select>
          </label>
          {game === "shooting" ? (
            <label>
              슈팅 대표
              <select
                value={slot}
                onChange={(e) => {
                  setSlot(e.target.value as Slot);
                  setValue("");
                }}
              >
                <option value="male">
                  남자 · {selectedTeam.male || "미등록"}
                </option>
                <option value="female">
                  여자 · {selectedTeam.female || "미등록"}
                </option>
              </select>
            </label>
          ) : (
            <div className={styles.rosterSummary}>
              출전 선수 6명
              <strong>
                {selectedTeam.keepUpPlayers.filter(Boolean).join(" · ") ||
                  "명단 등록 대기"}
              </strong>
            </div>
          )}
        </div>
        <div className={styles.turnInfo}>
          <span>{activeTie ? "동률 해소 · 순위 결정전" : "정규 도전"}</span>
          <b>
            {Math.min(completed + 1, allowed)} / {allowed}차 시도{" "}
            {completed >= allowed ? "· 완료" : ""}
          </b>
        </div>
        <form onSubmit={(e) => void publish(e)}>
          <label className={styles.recordInputLabel}>
            {game === "shooting"
              ? "스피드건 측정 속도"
              : state.setup.metric === "seconds"
                ? "공을 살린 시간"
                : "연속 터치 횟수"}
            <div className={styles.recordInput}>
              <input
                aria-label={
                  game === "shooting" ? "측정 속도" : "공 살리기 기록"
                }
                inputMode={
                  game === "keepUp" && state.setup.metric === "touches"
                    ? "numeric"
                    : "decimal"
                }
                placeholder={
                  game === "shooting"
                    ? "0.0"
                    : state.setup.metric === "seconds"
                      ? "0.00"
                      : "0"
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={
                  blocked || completed >= allowed || state.finalized[game]
                }
                autoComplete="off"
              />
              <span>{recordUnit(game, state.setup.metric)}</span>
            </div>
          </label>
          {game === "keepUp" && state.setup.metric === "seconds" && (
            <div className={styles.stopwatch}>
              <span>
                {timerStart === null
                  ? "현장 스톱워치"
                  : `${elapsed.toFixed(2)}초`}
              </span>
              <button
                type="button"
                disabled={blocked || completed >= allowed}
                onClick={() => {
                  if (timerStart === null) {
                    setElapsed(0);
                    setTimerStart(performance.now());
                  } else {
                    setValue(
                      ((performance.now() - timerStart) / 1000).toFixed(2),
                    );
                    setTimerStart(null);
                  }
                }}
              >
                {timerStart === null ? "측정 시작" : "정지하고 기록 입력"}
              </button>
            </div>
          )}
          <button
            className={styles.publishButton}
            disabled={blocked || completed >= allowed || state.finalized[game]}
            type="submit"
          >
            {busy ? "기록 저장 중…" : "기록 저장 + 중계 공개"}
            <span>↗</span>
          </button>
        </form>
        <p className={styles.help}>
          공개하면 {state.setup.revealSeconds}초 후 양 팀 비교로 전환됩니다.
          다음 차례는 직접 눌러 진행합니다.
        </p>
        {localError && (
          <p className={styles.notice} role="status">
            {localError}
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            disabled={blocked}
            onClick={() => void show("prepare")}
          >
            선수 준비 화면
          </button>
          <button
            className={styles.secondaryButton}
            disabled={blocked}
            onClick={() => void nextTurn()}
          >
            다음 차례 →
          </button>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.sectionHeading}>
          <h3>종목 결과 확정</h3>
          <b>{rows.filter((r) => r.complete).length} / 6팀 완료</b>
        </div>
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
              <small>{r.tied ? "동률" : r.complete ? "완료" : "도전 중"}</small>
            </div>
          ))}
        </div>
        {!activeTie &&
          groups.map((ids) => (
            <div className={styles.tieNotice} key={ids.join()}>
              <p>
                {ids
                  .map((id) => state.setup.teams.find((t) => t.id === id)!.name)
                  .join(" · ")}{" "}
                기록 동률
              </p>
              <button
                className={styles.secondaryButton}
                disabled={blocked}
                onClick={async () => {
                  if (await send({ type: "tiebreak", game, teamIds: ids })) {
                    setTeamId(ids[0]);
                    setPair(ids.slice(0, 2));
                    setSlot("male");
                    setValue("");
                  }
                }}
              >
                이 팀들의 순위 결정전 시작
              </button>
            </div>
          ))}
        {activeTie && (
          <p className={styles.notice}>
            순위 결정전 진행 중입니다.{" "}
            {game === "shooting"
              ? "동점 팀의 남녀 대표가 한 번씩"
              : "동점 팀이 한 번씩"}{" "}
            재도전합니다. 위 입력창에 추가 기록을 입력해 주세요.
          </p>
        )}
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            disabled={busy}
            onClick={() => void show(game)}
          >
            종목 순위 송출
          </button>
          <button
            className={styles.primaryButton}
            disabled={blocked || !ready || state.finalized[game]}
            onClick={() => void send({ type: "finalize", game })}
          >
            {state.finalized[game] ? "결과 확정 완료" : "종목 결과 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RecordHistory({
  state,
  send,
  busy,
}: {
  state: EventState;
  send: Send;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  return (
    <div>
      <div className={styles.sectionHeading}>
        <div>
          <span>04 / RECORD LOG</span>
          <h2>모든 도전의 기록</h2>
        </div>
        <b>{state.attempts.length}건</b>
      </div>
      <p className={styles.help}>
        정정·무효 처리 시 해당 종목의 결과 확정과 우승 발표가 해제됩니다. 해당
        종목의 순위 결정전 기록도 무효 처리되어 다시 판정합니다.
      </p>
      {!state.attempts.length && (
        <p className={styles.emptyState}>
          첫 번째 도전 기록을 기다리고 있습니다.
        </p>
      )}
      <div className={styles.history}>
        {[...state.attempts].reverse().map((a) => {
          const t = state.setup.teams.find((t) => t.id === a.teamId)!;
          return (
            <article key={a.id} className={a.voided ? styles.voided : ""}>
              <div>
                <small>
                  {a.game === "shooting" ? "슈팅왕" : "공 살리기"}
                  {a.tieId ? " · 순위 결정전" : ""}
                  {a.voided ? " · 무효" : ""}
                </small>
                <strong>{t.name}</strong>
                <span>{a.slot ? t[a.slot] : "6인 공 살리기"}</span>
              </div>
              {editing === a.id ? (
                <div className={styles.editRecord}>
                  <input
                    aria-label="정정 기록"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode="decimal"
                  />
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await send({
                          type: "correct",
                          attemptId: a.id,
                          value: Number(value),
                        })
                      )
                        setEditing(null);
                    }}
                  >
                    정정 저장
                  </button>
                  <button onClick={() => setEditing(null)}>취소</button>
                </div>
              ) : (
                <>
                  <b>
                    {formatRecord(a.value, a.game, state.setup.metric)}
                    <small>{recordUnit(a.game, state.setup.metric)}</small>
                  </b>
                  {!a.voided && (
                    <div>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void send({ type: "replay", attemptId: a.id })
                        }
                      >
                        다시 공개
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditing(a.id);
                          setValue(String(a.value));
                        }}
                      >
                        정정
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void send({ type: "void", attemptId: a.id })
                        }
                      >
                        무효
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
