"use client";

import Link from "next/link";
import { useState } from "react";
import { BroadcastScreen } from "./broadcast";
import { useEventConnection, useServerNow } from "./client";
import { SetupForm } from "./setup-form";
import { GameControls, RecordHistory } from "./game-controls";
import { overallStandings } from "./scoring";
import type { Scene } from "./types";
import styles from "./event.module.css";

export function ControlPage({ id }: { id: string }) {
  const {
    state,
    output,
    token,
    connected,
    busy,
    uncertain,
    error,
    setError,
    send,
    retry,
    offset,
  } = useEventConnection(id, true);
  const now = useServerNow(offset);
  const [tab, setTab] = useState("game");
  const [copied, setCopied] = useState("");
  const [host, setHost] = useState("");
  const blocked = busy || uncertain;
  const displayPath = `/events/alliance/${id}/display`;
  async function copy(kind: "display" | "overlay" | "control") {
    try {
      const base = host.trim() || location.origin;
      const url = new URL(
        kind === "control" ? `/events/alliance/${id}/control` : displayPath,
        base,
      );
      if (kind === "control")
        url.hash = new URLSearchParams({ token: token ?? "" }).toString();
      if (kind === "overlay") url.searchParams.set("overlay", "1");
      if (navigator.clipboard)
        await navigator.clipboard.writeText(url.toString());
      else {
        const input = document.createElement("textarea");
        input.value = url.toString();
        document.body.appendChild(input);
        input.select();
        const success = document.execCommand("copy");
        input.remove();
        if (!success)
          throw new Error("이 브라우저에서는 주소 복사를 지원하지 않습니다.");
      }
      setCopied(
        kind === "control"
          ? "운영 링크를 복사했습니다. 운영 담당자에게만 전달해 주세요."
          : "출력 주소를 복사했습니다.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소를 복사하지 못했습니다.");
    }
  }
  function backup() {
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `alliance-event-${id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const show = (scene: Scene) =>
    state &&
    send({
      type: "show",
      scene,
      game: output?.game ?? "shooting",
      pair: output?.pair ?? [state.setup.teams[0].id, state.setup.teams[3].id],
      teamId: output?.focusTeamId ?? state.setup.teams[0].id,
    });
  return (
    <main className={styles.controlPage}>
      <header className={styles.controlHeader}>
        <Link href="/events/alliance" className={styles.controlBrand}>
          FAIRGROUND<span>EVENT DESK</span>
        </Link>
        <div className={styles.controlHeaderRight}>
          <span className={connected ? styles.connected : styles.disconnected}>
            <i />
            {connected ? "서버 연결됨" : "연결 확인 중"}
          </span>
          <a
            className={styles.openDisplay}
            href={displayPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            출력 화면 열기 ↗
          </a>
        </div>
      </header>
      <div className={styles.controlTitle}>
        <div>
          <p className={styles.eyebrow}>ALLIANCE CHALLENGE / CONTROL ROOM</p>
          <h1>
            연합팀 이벤트 <span>운영 데스크</span>
          </h1>
          <p>기록은 정확하게. 순간은 더 크게.</p>
        </div>
        {state?.demo && <span className={styles.demoBadge}>연습 이벤트</span>}
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
          {uncertain && (
            <button disabled={busy} onClick={() => void retry()}>
              같은 저장 요청 다시 확인
            </button>
          )}
          <button aria-label="오류 안내 닫기" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {!state || !output ? (
        <div className={styles.emptyState}>
          <b>이벤트를 불러오고 있습니다.</b>
          <p>운영 전용 링크와 현장 서버 연결을 확인해 주세요.</p>
          <Link href="/events/alliance">이벤트 목록으로</Link>
        </div>
      ) : (
        <div className={styles.controlGrid}>
          <div className={styles.workspace}>
            <nav className={styles.workspaceTabs} aria-label="이벤트 운영 메뉴">
              {[
                ["setup", "01", "팀 편성"],
                ["game", "02", "경기 진행"],
                ["results", "03", "종합 결과"],
                ["history", "04", "기록 내역"],
              ].map(([key, n, label]) => (
                <button
                  key={key}
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => setTab(key)}
                >
                  <small>{n}</small>
                  {label}
                </button>
              ))}
            </nav>
            <div className={styles.workspaceContent}>
              {state.demo && state.attempts.length === 0 && (
                <div className={styles.demoNotice}>
                  <span>연습용 선수 명단이 준비되어 있습니다.</span>
                  <button
                    disabled={blocked}
                    onClick={() => void send({ type: "demo-records" })}
                  >
                    연습 기록 채우기
                  </button>
                </div>
              )}
              {tab === "setup" && (
                <SetupForm key={id} state={state} send={send} busy={blocked} />
              )}
              {tab === "game" && (
                <GameControls state={state} send={send} busy={blocked} />
              )}
              {tab === "history" && (
                <RecordHistory state={state} send={send} busy={blocked} />
              )}
              {tab === "results" && (
                <div>
                  <div className={styles.sectionHeading}>
                    <div>
                      <span>03 / FINAL STANDINGS</span>
                      <h2>하나의 우승팀을 향해</h2>
                    </div>
                  </div>
                  <p className={styles.help}>
                    슈팅왕 최대 100점 + 본게임 공 살리기 최대 1,000점. 두 종목을
                    모두 확정해야 우승 발표가 열립니다.
                  </p>
                  <div className={styles.resultBadges}>
                    <span>
                      슈팅왕 {state.finalized.shooting ? "✓ 확정" : "확정 대기"}
                    </span>
                    <span>
                      공 살리기{" "}
                      {state.finalized.keepUp ? "✓ 확정" : "확정 대기"}
                    </span>
                  </div>
                  <table className={styles.resultsTable}>
                    <thead>
                      <tr>
                        <th>연합팀</th>
                        <th>슈팅왕</th>
                        <th>공 살리기</th>
                        <th>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallStandings(state).map((r) => (
                        <tr key={r.teamId}>
                          <th>
                            {
                              state.setup.teams.find((t) => t.id === r.teamId)!
                                .name
                            }
                          </th>
                          <td>{r.shooting ?? "—"}</td>
                          <td>{r.keepUp ?? "—"}</td>
                          <td>
                            <strong>{r.total?.toLocaleString() ?? "—"}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryButton}
                      disabled={blocked}
                      onClick={() => void show("overall")}
                    >
                      종합 순위 송출
                    </button>
                    <button
                      className={styles.primaryButton}
                      disabled={
                        blocked ||
                        !state.finalized.shooting ||
                        !state.finalized.keepUp
                      }
                      onClick={() => void show("winner")}
                    >
                      ★ 최종 우승팀 발표
                    </button>
                  </div>
                  <p className={styles.help}>
                    본게임 한 순위 차이(200점)가 슈팅 최대 차이(100점)보다 커서,
                    최종 순위는 공 살리기 단독 순위대로 결정됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
          <aside className={styles.monitorColumn}>
            <div className={styles.monitorHeading}>
              <b>
                <i />
                ON AIR · 송출 미리보기
              </b>
              <span>16:9 / 1920 × 1080</span>
            </div>
            <div className={styles.preview}>
              <BroadcastScreen output={output} now={now} />
            </div>
            <div className={styles.monitorControls}>
              <button
                disabled={blocked}
                onClick={() =>
                  void send({ type: output.held ? "resume" : "hold" })
                }
              >
                {output.held ? "▶ 자동 전환 재개" : "Ⅱ 기록 화면 유지"}
              </button>
              <button disabled={blocked} onClick={() => void show("compare")}>
                양 팀 비교
              </button>
              <button disabled={blocked} onClick={() => void show("standby")}>
                대기 화면
              </button>
              <button disabled={blocked} onClick={() => void show("overall")}>
                종합 순위
              </button>
            </div>
            <section className={styles.connectionPanel}>
              <h3>중계 화면 연결</h3>
              <p>
                OBS 브라우저 소스에 출력 주소를 붙여 넣고 크기를 1920 × 1080으로
                설정하세요. 전체화면은 출력 창에서 F 키를 누릅니다.
              </p>
              <div className={styles.actions}>
                <button onClick={() => void copy("display")}>
                  출력 주소 복사
                </button>
                <button onClick={() => void copy("overlay")}>
                  OBS 투명 주소
                </button>
              </div>
              <details>
                <summary>다른 기기에서 입력·송출하기</summary>
                <p>
                  같은 네트워크에서 이 노트북의 IP 주소와 포트로 접속합니다. 예:
                  http://192.168.0.10:3100
                </p>
                <label>
                  공유할 서버 주소
                  <input
                    placeholder="이 노트북의 네트워크 주소"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </label>
                <button onClick={() => void copy("control")}>
                  운영 전용 링크 복사
                </button>
                <p>
                  운영 링크에는 기록 수정 권한이 있습니다. 출력 담당자에게는
                  출력 주소만 전달하세요.
                </p>
              </details>
              {copied && (
                <p className={styles.success} role="status">
                  {copied}
                </p>
              )}
            </section>
            <div className={styles.savePanel}>
              <div>
                <b>기록 저장됨 · v{state.version}</b>
                <p>이 노트북에 저장됩니다. 새로고침 후에도 복원됩니다.</p>
              </div>
              <button onClick={backup}>기록 백업 ↓</button>
            </div>
            <p className={styles.localNote}>
              송출 중에는 현장 운영 서버를 계속 켜두세요. 연결이 끊겨도 출력
              화면은 마지막 기록을 유지합니다.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
