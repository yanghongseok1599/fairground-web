"use client";

import { useState } from "react";
import { formatRecord, recordUnit } from "./scoring";
import type { Command, EventState } from "./types";
import styles from "./event.module.css";

type Send = (command: Command) => Promise<boolean>;

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
