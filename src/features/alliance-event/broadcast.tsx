"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { formatRecord, recordUnit, GAME_LABELS } from "./scoring";
import { audienceView, audienceRecords } from "./broadcast-model";
import { useEventConnection, useServerNow } from "./client";
import type { AllianceTeam, Output } from "./types";
import styles from "./event.module.css";
import screen from "./broadcast.module.css";

const number = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("ko-KR");

function TeamLabel({ team }: { team: AllianceTeam }) {
  return (
    <span className={screen.teamLabel}>
      <i style={{ background: team.color }} />
      <strong
        className={team.name.length > 16 ? screen.longName : undefined}
        title={team.name}
      >
        {team.name}
      </strong>
    </span>
  );
}

export function BroadcastScreen({
  output,
  now,
  overlay = false,
}: {
  output: Output;
  now: number;
  overlay?: boolean;
}) {
  const { tab, game } = audienceView(output, now);
  const focus = output.teams.find((t) => t.id === output.focusTeamId)!;
  const rows = audienceRecords(output, game);
  const unit = recordUnit(game, output.metric);
  const final = output.finalized.shooting && output.finalized.keepUp;
  const liveValue = output.scene === "reveal" ? output.value : null;
  const tabs = [
    ["live", game === "shooting" ? "속도 · km/h" : `기록 · ${unit}`],
    ["records", "팀별 기록순위"],
    ["scores", "종합 스코어"],
  ];
  return (
    <section
      className={`${screen.canvas} ${overlay ? screen.overlay : ""}`}
      aria-label="관객 화면"
      data-audience-tab={tab}
    >
      <header className={screen.header}>
        <div className={screen.labels} aria-label="현재 출력 항목">
          {tabs.map(([key, label]) => (
            <span key={key} data-active={tab === key}>
              {label}
            </span>
          ))}
        </div>
        <span className={screen.gameLabel}>
          {output.demo && <small>연습</small>}
          {tab === "scores" ? "연합팀 대항전" : GAME_LABELS[game]}
        </span>
      </header>
      {tab === "live" ? (
        <div
          className={`${screen.measurement} ${game === "shooting" ? screen.speed : ""}`}
          style={{ "--team-color": focus.color } as CSSProperties}
        >
          <div className={screen.liveTeam}>
            <TeamLabel team={focus} />
          </div>
          {output.playerName && (
            <p className={screen.player}>{output.playerName}</p>
          )}
          <div
            className={screen.value}
            key={`${output.publishedAt}-${liveValue}`}
          >
            <strong>{formatRecord(liveValue, game, output.metric)}</strong>
            <span>{unit}</span>
          </div>
          {liveValue === null && <p className={screen.awaiting}>측정 대기</p>}
        </div>
      ) : tab === "records" ? (
        <div className={screen.board}>
          <div className={screen.boardHeading}>
            <h1>{GAME_LABELS[game]} 기록순위</h1>
            <p>
              {output.finalized[game] ? "최종 기록" : "진행 중 · 임시 순위"}
            </p>
          </div>
          <table className={screen.records}>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">연합팀</th>
                <th scope="col">
                  {game === "shooting" ? "팀 평균" : "최고 기록"}{" "}
                  <small>({unit})</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = output.teams.find((t) => t.id === row.teamId)!;
                return (
                  <tr key={team.id} data-leading={row.displayRank === 1}>
                    <td className={screen.rank}>
                      {row.shared && <small>공동</small>}
                      {number(row.displayRank)}
                    </td>
                    <td>
                      <TeamLabel team={team} />
                      {game === "shooting" && (
                        <p className={screen.subRecord}>
                          남 {formatRecord(row.male, game, output.metric)} · 여{" "}
                          {formatRecord(row.female, game, output.metric)}
                          {row.value === null &&
                            (row.male !== null || row.female !== null) &&
                            " · 평균 대기"}
                        </p>
                      )}
                    </td>
                    <td className={screen.record}>
                      {formatRecord(row.value, game, output.metric)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={screen.board}>
          <div className={screen.boardHeading}>
            <h1>{final ? "최종 스코어" : "종합 스코어"}</h1>
            <p>{final ? "최종 결과" : "확정된 종목만 합산"}</p>
          </div>
          <table className={screen.scores}>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">연합팀</th>
                <th scope="col">슈팅왕</th>
                <th scope="col">공 살리기</th>
                <th scope="col">합계</th>
              </tr>
            </thead>
            <tbody>
              {output.overall.map((row) => {
                const team = output.teams.find((t) => t.id === row.teamId)!;
                return (
                  <tr key={team.id} data-leading={row.rank === 1}>
                    <td className={screen.rank}>{number(row.rank)}</td>
                    <td>
                      <TeamLabel team={team} />
                      {final && row.rank === 1 && (
                        <p className={screen.champion}>최종 우승</p>
                      )}
                    </td>
                    <td className={screen.points}>{number(row.shooting)}</td>
                    <td className={screen.points}>{number(row.keepUp)}</td>
                    <td className={screen.total}>{number(row.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function BroadcastPage({ id }: { id: string }) {
  const { output, connected, offset } = useEventConnection(id, false);
  const now = useServerNow(offset);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f")
        void document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  // Query-driven transparency is presentation-only; the server's public data is identical.
  const [overlay, setOverlay] = useOverlay();
  return (
    <main
      className={`${styles.broadcastRoute} ${screen.route}`}
      data-alliance-overlay={overlay ? "true" : "false"}
    >
      {output ? (
        <BroadcastScreen output={output} now={now} overlay={overlay} />
      ) : (
        <div className={styles.waiting}>
          <b>FAIRGROUND</b>
          <p>중계 연결을 기다리고 있습니다.</p>
          <small>운영 서버와 이벤트 주소를 확인해 주세요.</small>
        </div>
      )}
      {!connected && output && (
        <div className={styles.connectionNotice}>
          연결 확인 중 · 마지막 기록 유지
        </div>
      )}
      <div className={styles.displayTools}>
        <button
          onClick={() =>
            void document.documentElement.requestFullscreen().catch(() => {})
          }
        >
          전체화면 · F
        </button>
        <button onClick={() => setOverlay(!overlay)}>
          {overlay ? "전체 배경" : "투명 배경"}
        </button>
      </div>
    </main>
  );
}

function useOverlay() {
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    queueMicrotask(() =>
      setOverlay(new URLSearchParams(location.search).get("overlay") === "1"),
    );
  }, []);
  return [overlay, setOverlay] as const;
}
