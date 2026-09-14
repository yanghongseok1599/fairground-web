"use client";

import { useEffect } from "react";
import { effectiveScene } from "./engine";
import { formatRecord, recordUnit } from "./scoring";
import { useEventConnection, useServerNow } from "./client";
import type { AllianceTeam, Output } from "./types";
import styles from "./event.module.css";

const number = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("ko-KR");
function TeamName({ team, output }: { team: AllianceTeam; output: Output }) {
  return (
    <>
      <div className={styles.teamName}>{team.name}</div>
      <div className={styles.sources}>
        {team.sourceIds.map((id) => output.sourceNames[id]).join(" + ")}
      </div>
    </>
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
  const scene = effectiveScene(output, now);
  const focus =
    output.teams.find((t) => t.id === output.focusTeamId) ?? output.teams[0];
  const winner = output.teams.find((t) => t.id === output.winnerId);
  const game =
    scene === "keepUp"
      ? "keepUp"
      : scene === "shooting"
        ? "shooting"
        : output.game;
  const main = game === "keepUp";
  const rows = main ? output.keepUp : output.shooting;
  const total = scene === "overall" || scene === "winner";
  return (
    <section
      className={`${styles.screen} ${overlay ? styles.overlay : ""}`}
      aria-label="중계 출력"
      data-scene={scene}
    >
      <div className={styles.court} aria-hidden="true">
        <i />
        <b />
      </div>
      <header className={styles.screenHeader}>
        <div className={styles.wordmark}>
          FAIR<span>GROUND</span>
          <small>ALLIANCE CHALLENGE</small>
        </div>
        <div className={styles.screenEvent}>
          {output.title}
          <span>
            {output.demo
              ? "REHEARSAL · 연습 이벤트"
              : "12 TEAMS · 6 ALLIANCES · ONE CHAMPION"}
          </span>
        </div>
        <div className={styles.liveBadge}>
          <i />
          {output.demo ? "REHEARSAL" : "LIVE"}
        </div>
      </header>
      <div className={styles.screenBody}>
        {scene === "standby" ? (
          <div className={styles.standby}>
            <p className={styles.eyebrow}>BETTER TOGETHER</p>
            <h1>
              우리의 이름으로.
              <br />
              <em>하나의 팀으로.</em>
            </h1>
            <p>슈팅왕 100점 + 공 살리기 1,000점</p>
            <div className={styles.sixTeams}>
              {output.teams.map((t) => (
                <div
                  key={t.id}
                  style={{ "--team-color": t.color } as React.CSSProperties}
                >
                  <small>{t.group} ALLIANCE</small>
                  <strong>{t.name}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : scene === "prepare" ? (
          <div className={styles.prepare}>
            <p className={styles.eyebrow}>
              {main ? "MAIN EVENT / 1,000 PTS" : "BONUS GAME / 100 PTS"}
            </p>
            <span className={styles.prepareLabel}>NEXT UP · 도전 준비</span>
            <div style={{ color: focus.color }}>
              <TeamName team={focus} output={output} />
            </div>
            <h1>{main ? "함께 살려라!" : output.playerName}</h1>
            <p>
              {main
                ? focus.keepUpPlayers.join(" · ")
                : "슈팅왕 챌린지 · 측정 대기"}
            </p>
          </div>
        ) : scene === "reveal" ? (
          <div className={styles.reveal} key={output.publishedAt}>
            <p className={styles.eyebrow}>
              {main ? "MAIN EVENT · 공 살리기" : "BONUS GAME · 슈팅왕"}
            </p>
            <div className={styles.revealTeam} style={{ color: focus.color }}>
              {focus.name}
              <span>{output.playerName}</span>
            </div>
            <div className={styles.heroNumber}>
              {formatRecord(output.value, game, output.metric)}
              <small>{recordUnit(game, output.metric)}</small>
            </div>
            <p className={styles.recordCaption}>공식 측정 기록</p>
            <div className={styles.countdown}>
              <i
                style={{
                  transform: `scaleX(${output.held ? 1 : Math.max(0, 1 - (now - output.publishedAt) / output.durationMs)})`,
                }}
              />
            </div>
          </div>
        ) : scene === "compare" ? (
          <div className={styles.compare}>
            <div className={styles.compareHeading}>
              <div>
                <p className={styles.eyebrow}>
                  {main ? "MAIN EVENT" : "BONUS GAME"}
                </p>
                <h1>
                  {main ? "공 살리기" : "슈팅왕"} <span>팀 기록</span>
                </h1>
              </div>
              <small>
                {main
                  ? "두 번의 도전 중 최고 기록"
                  : "남녀 대표의 개인 최고 속도 평균"}
              </small>
            </div>
            <div className={styles.pairGrid}>
              {output.pair.map((id) => {
                const t = output.teams.find((team) => team.id === id)!;
                const row = rows.find((r) => r.teamId === id);
                const comparisonValue = main
                  ? (row?.value ?? null)
                  : (row?.value ?? row?.male ?? row?.female ?? null);
                return (
                  <article
                    key={id}
                    className={styles.pairCard}
                    style={{ "--team-color": t.color } as React.CSSProperties}
                  >
                    <div className={styles.groupTag}>{t.group} ALLIANCE</div>
                    <TeamName team={t} output={output} />
                    <div className={styles.pairMetricLabel}>
                      {main
                        ? "최고 기록"
                        : row?.value !== null && row?.value !== undefined
                          ? "남녀 대표 평균"
                          : row?.male !== null && row?.male !== undefined
                            ? "남자 대표 기록 · 평균 산정 대기"
                            : row?.female !== null && row?.female !== undefined
                              ? "여자 대표 기록 · 평균 산정 대기"
                              : "첫 도전 대기"}
                    </div>
                    <div className={styles.pairNumber}>
                      {formatRecord(comparisonValue, game, output.metric)}
                      <small>{recordUnit(game, output.metric)}</small>
                    </div>
                    <div className={styles.pairDetails}>
                      {main ? (
                        <span>
                          이전 도전{" "}
                          <b>
                            {formatRecord(
                              row?.secondary ?? null,
                              game,
                              output.metric,
                            )}
                          </b>
                        </span>
                      ) : (
                        <>
                          <span>
                            남자 대표{" "}
                            <b>
                              {formatRecord(
                                row?.male ?? null,
                                game,
                                output.metric,
                              )}
                            </b>
                          </span>
                          <span>
                            여자 대표{" "}
                            <b>
                              {formatRecord(
                                row?.female ?? null,
                                game,
                                output.metric,
                              )}
                            </b>
                          </span>
                        </>
                      )}
                    </div>
                    <div className={styles.pairStatus}>
                      {row?.complete
                        ? row.tied
                          ? "기록 동률 · 순위 결정 대기"
                          : "정규 시도 완료"
                        : "도전 진행 중"}
                    </div>
                  </article>
                );
              })}
              <div className={styles.versus}>VS</div>
            </div>
          </div>
        ) : scene === "winner" && winner ? (
          <div className={styles.winner}>
            <div className={styles.winnerHalo} aria-hidden="true" />
            <p className={styles.eyebrow}>ONE TEAM. ONE CHAMPION.</p>
            <div className={styles.crown}>★</div>
            <p className={styles.champion}>CHAMPIONS</p>
            <h1>{winner.name}</h1>
            <p>
              {winner.sourceIds.map((id) => output.sourceNames[id]).join(" + ")}
            </p>
            <div className={styles.winnerScore}>
              {number(
                output.overall.find((r) => r.teamId === winner.id)?.total ??
                  null,
              )}
              <small>POINTS</small>
            </div>
          </div>
        ) : (
          <div className={styles.leaderboard}>
            <div className={styles.boardHeading}>
              <div>
                <p className={styles.eyebrow}>
                  {total
                    ? "ALLIANCE STANDINGS"
                    : main
                      ? "MAIN EVENT / 1,000 PTS"
                      : "BONUS GAME / 100 PTS"}
                </p>
                <h1>
                  {total
                    ? "종합 순위"
                    : main
                      ? "공 살리기 순위"
                      : "슈팅왕 순위"}
                </h1>
              </div>
              <span className={styles.boardState}>
                {total
                  ? output.finalized.shooting && output.finalized.keepUp
                    ? "FINAL RESULTS"
                    : "진행 중 · 확정된 종목만 합산"
                  : output.finalized[game]
                    ? "OFFICIAL RESULTS"
                    : "진행 중 · 임시 기록"}
              </span>
            </div>
            <div className={styles.boardColumns}>
              <span>RANK</span>
              <span>ALLIANCE TEAM</span>
              <span>{total ? "슈팅왕" : main ? "최고 기록" : "팀 평균"}</span>
              <span>{total ? "공 살리기" : "상태"}</span>
              <span>{total ? "TOTAL" : "POINTS"}</span>
            </div>
            {(total ? output.overall : rows).map((row, index) => {
              const t = output.teams.find((team) => team.id === row.teamId)!;
              const s = total
                ? output.overall.find((r) => r.teamId === t.id)!
                : null;
              const r = total ? null : rows.find((r) => r.teamId === t.id)!;
              const official = total
                ? output.finalized.shooting && output.finalized.keepUp
                : output.finalized[game];
              return (
                <div
                  key={t.id}
                  className={`${styles.boardRow} ${index === 0 && official ? styles.firstRow : ""}`}
                  style={{ "--team-color": t.color } as React.CSSProperties}
                >
                  <span className={styles.rank}>
                    {official ? String(row.rank ?? "—").padStart(2, "0") : "—"}
                  </span>
                  <div className={styles.boardTeam}>
                    <i />
                    <div>
                      <strong>{t.name}</strong>
                      <small>
                        {t.group}조 ·{" "}
                        {t.sourceIds
                          .map((id) => output.sourceNames[id])
                          .join(" + ")}
                      </small>
                    </div>
                  </div>
                  <span className={styles.boardValue}>
                    {s
                      ? number(s.shooting)
                      : formatRecord(r!.value, game, output.metric)}
                    {!s && <small>{recordUnit(game, output.metric)}</small>}
                  </span>
                  <span className={s ? styles.boardValue : styles.rowStatus}>
                    {s
                      ? number(s.keepUp)
                      : r!.tied
                        ? "재도전 대기"
                        : r!.complete
                          ? "시도 완료"
                          : "진행 중"}
                  </span>
                  <strong className={styles.boardPoints}>
                    {s ? number(s.total) : official ? number(r!.points) : "—"}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <footer className={styles.screenFooter}>
        <span>FAIR PLAY. REAL CONNECTION.</span>
        <span>
          {total
            ? "슈팅왕 100 + 공 살리기 1,000"
            : main
              ? "6명이 함께 만드는 하나의 기록"
              : "남자 1명 + 여자 1명 · 연합팀 챌린지"}
        </span>
        <b>FAIRGROUND</b>
      </footer>
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
      className={styles.broadcastRoute}
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

import { useState } from "react";
function useOverlay() {
  const [overlay, setOverlay] = useState(false);
  useEffect(() => {
    queueMicrotask(() =>
      setOverlay(new URLSearchParams(location.search).get("overlay") === "1"),
    );
  }, []);
  return [overlay, setOverlay] as const;
}
