"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BroadcastScreen } from "./broadcast";
import { useEventConnection, useServerNow } from "./client";
import { SetupForm } from "./setup-form";
import { GameControls } from "./game-controls";
import { RecordHistory } from "./record-history";
import { ResultsPanel } from "./results-panel";
import {
  EVENT_STEPS,
  currentEventStep,
  rosterIssue,
  type EventStep,
} from "./workflow";
import ui from "./operator.module.css";
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
  const [chosenStep, setChosenStep] = useState<EventStep | null>(null);
  const [copied, setCopied] = useState("");
  const [host, setHost] = useState("");
  const workspaceRef = useRef<HTMLElement>(null);
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
  const current = state ? currentEventStep(state) : 0;
  const step = Math.min(chosenStep ?? current, current) as EventStep;
  useEffect(() => {
    workspaceRef.current?.scrollIntoView({ block: "start" });
    Array.from(workspaceRef.current?.querySelectorAll<HTMLElement>("h2") ?? [])
      .find((heading) => heading.getClientRects().length > 0)
      ?.focus({ preventScroll: true });
  }, [step]);
  return (
    <main className={styles.controlPage}>
      <header className={styles.controlHeader}>
        <Link href="/events/alliance" className={styles.controlBrand}>
          FAIRGROUND
        </Link>
        <div className={styles.controlHeaderRight}>
          <span className={connected ? styles.connected : styles.disconnected}>
            <i />
            {connected ? "연결됨" : "연결 확인 중"}
          </span>
          <a
            className={styles.openDisplay}
            href={displayPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            중계 화면 열기 ↗
          </a>
        </div>
      </header>
      <div className={ui.heading}>
        <div>
          <h1>이벤트 진행</h1>
          <p>순서대로 준비하고, 기록만 입력하세요.</p>
        </div>
        {state?.demo && <span className={styles.demoBadge}>연습 중</span>}
      </div>
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
          {uncertain && (
            <button disabled={busy} onClick={() => void retry()}>
              저장 결과 다시 확인
            </button>
          )}
          <button aria-label="오류 안내 닫기" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {!state || !output ? (
        <div className={styles.emptyState}>
          <b>이벤트를 불러오는 중입니다.</b>
          <p>운영 전용 링크와 현장 서버 연결을 확인해주세요.</p>
          <Link href="/events/alliance">이벤트 목록으로</Link>
        </div>
      ) : (
        <div className={ui.layout}>
          <div>
            <section ref={workspaceRef} className={styles.workspace}>
              <nav className={ui.steps} aria-label="이벤트 진행 순서">
                {EVENT_STEPS.map((label, i) => (
                  <button
                    key={label}
                    disabled={i > current || blocked}
                    aria-current={step === i ? "step" : undefined}
                    onClick={() => setChosenStep(i as EventStep)}
                  >
                    <span>{i < current ? "✓" : i + 1}</span>
                    {label}
                  </button>
                ))}
              </nav>
              <div className={styles.workspaceContent}>
                <div hidden={step !== 0}>
                  <SetupForm
                    key={id}
                    state={state}
                    send={send}
                    busy={blocked}
                    onStart={() => setChosenStep(1)}
                  />
                </div>
                {(step === 1 || step === 2) && (
                  <GameControls
                    key={step}
                    state={state}
                    send={send}
                    busy={blocked}
                    game={step === 1 ? "shooting" : "keepUp"}
                    onNext={() => setChosenStep((step + 1) as EventStep)}
                  />
                )}
                {step === 3 && (
                  <ResultsPanel
                    state={state}
                    busy={blocked}
                    show={(scene) => void show(scene)}
                  />
                )}
              </div>
            </section>
            <details className={ui.tools}>
              <summary>입력한 기록 확인 · 잘못 입력한 기록 수정</summary>
              <div>
                <RecordHistory state={state} send={send} busy={blocked} />
              </div>
            </details>
          </div>
          <aside className={ui.previewAside}>
            <div className={ui.previewCaption}>
              <b>관객에게 보이는 화면</b>
              <a href={displayPath} target="_blank" rel="noopener noreferrer">
                크게 보기 ↗
              </a>
            </div>
            <div className={styles.preview}>
              <BroadcastScreen output={output} now={now} />
            </div>
            <p className={ui.previewHelp}>
              입력 중인 숫자는 보이지 않습니다. ‘기록 공개하기’를 누르면 이
              화면에 표시됩니다.
            </p>
            <details className={ui.tools}>
              <summary>중계 화면 직접 바꾸기</summary>
              <div className={styles.monitorControls}>
                <button
                  disabled={blocked}
                  onClick={() =>
                    void send({ type: output.held ? "resume" : "hold" })
                  }
                >
                  {output.held ? "자동 전환 다시 시작" : "현재 기록 화면 유지"}
                </button>
                <button disabled={blocked} onClick={() => void show("compare")}>
                  양 팀 비교
                </button>
                <button disabled={blocked} onClick={() => void show("standby")}>
                  대기 화면
                </button>
                <button disabled={blocked} onClick={() => void show("overall")}>
                  전체 순위
                </button>
              </div>
            </details>
            <details className={ui.tools}>
              <summary>OBS · 다른 기기 연결</summary>
              <div className={styles.connectionPanel}>
                <p>
                  OBS 브라우저 소스에 출력 주소를 넣고 크기를 1920 × 1080으로
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
                  <summary>다른 노트북·휴대폰에서 연결</summary>
                  <p>
                    같은 네트워크에서 이 노트북 주소로 접속합니다. 예:
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
                    운영 링크는 기록을 수정할 수 있습니다. 운영 담당자에게만
                    전달하세요.
                  </p>
                </details>
                {copied && (
                  <p className={styles.success} role="status">
                    {copied}
                  </p>
                )}
              </div>
            </details>
            <details className={ui.tools}>
              <summary>기록 백업{state.demo ? " · 연습 도구" : ""}</summary>
              <div>
                <button className={styles.secondaryButton} onClick={backup}>
                  기록 백업하기
                </button>
                {state.demo &&
                  state.attempts.length === 0 &&
                  state.setup.teams.every((team) => !rosterIssue(team)) && (
                    <div className={ui.section}>
                      <p className={styles.help}>
                        두 게임을 진행한 예시 기록으로 결과 화면을 확인합니다.
                      </p>
                      <button
                        className={styles.secondaryButton}
                        disabled={blocked}
                        onClick={async () => {
                          if (await send({ type: "demo-records" }))
                            setChosenStep(1);
                        }}
                      >
                        샘플 경기 기록 채우기
                      </button>
                    </div>
                  )}
              </div>
            </details>
            <p className={ui.previewHelp}>
              저장한 기록은 이 노트북에 보관됩니다. 행사 중에는 서버를 켜두세요.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
