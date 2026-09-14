"use client";

import { overallStandings } from "./scoring";
import type { EventState, Scene } from "./types";
import styles from "./event.module.css";
import ui from "./operator.module.css";

export function ResultsPanel({
  state,
  busy,
  show,
}: {
  state: EventState;
  busy: boolean;
  show: (scene: Scene) => void;
}) {
  const rows = overallStandings(state);
  const winner = state.setup.teams.find((team) => team.id === rows[0]?.teamId);
  return (
    <div>
      <div className={ui.intro}>
        <small>4단계 · 우승 발표</small>
        <h2 tabIndex={-1}>최종 우승팀이 정해졌습니다</h2>
        <p>
          두 종목의 합산 점수입니다. 아래 버튼을 누르면 중계 화면에 우승팀이
          나옵니다.
        </p>
      </div>
      {winner && (
        <div className={ui.champion}>
          <small>최종 우승</small>
          <h3>{winner.name}</h3>
          <b>{rows[0].total?.toLocaleString()}점</b>
        </div>
      )}
      <button
        className={ui.next}
        disabled={busy}
        onClick={() => show("winner")}
      >
        {state.output.scene === "winner"
          ? "우승 화면 다시 띄우기"
          : "우승팀 화면에 발표하기"}
      </button>
      {state.output.scene === "winner" && (
        <p className={ui.status} role="status">
          우승팀을 중계 화면에 공개했습니다.
        </p>
      )}
      <div className={ui.section}>
        <h3>최종 점수</h3>
        <table className={styles.resultsTable}>
          <thead>
            <tr>
              <th>팀</th>
              <th>슈팅왕</th>
              <th>공 살리기</th>
              <th>합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <th>
                  {
                    state.setup.teams.find((team) => team.id === row.teamId)!
                      .name
                  }
                </th>
                <td>{row.shooting ?? "—"}</td>
                <td>{row.keepUp ?? "—"}</td>
                <td>
                  <strong>{row.total?.toLocaleString() ?? "—"}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className={styles.secondaryButton}
        disabled={busy}
        onClick={() => show("overall")}
      >
        전체 순위 화면 띄우기
      </button>
    </div>
  );
}
