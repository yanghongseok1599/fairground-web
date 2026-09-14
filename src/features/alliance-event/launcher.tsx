"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readRecent, saveRecent, type RecentEvent } from "./client";
import styles from "./event.module.css";

export function EventLauncher() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    queueMicrotask(() => setRecent(readRecent()));
    void fetch("/api/alliance-events", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAvailable(data.available === true))
      .catch(() => setAvailable(false));
  }, []);
  async function create(demo: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/alliance-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "이벤트를 만들지 못했습니다.");
      // The secret stays in the fragment/browser storage and never reaches output URLs.
      try {
        saveRecent(
          { id: data.id, title: data.state.setup.title, demo },
          data.token,
        );
      } catch {
        /* The fragment still provides access if storage is temporarily unavailable. */
      }
      router.push(`/events/alliance/${data.id}/control#token=${data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "현장 서버를 확인해 주세요.");
      setBusy(false);
    }
  }
  return (
    <main className={styles.launcher}>
      <header className={styles.launchHeader}>
        <Link href="/">FAIRGROUND</Link>
        <span>EVENT OPERATIONS</span>
      </header>
      <div className={styles.launchHero}>
        <p className={styles.eyebrow}>12 TEAMS → 6 ALLIANCES → ONE CHAMPION</p>
        <h1>
          같이 뛰고.
          <br />
          <em>함께 이기다.</em>
        </h1>
        <p className={styles.launchDescription}>
          새로운 팀명, 새로운 동료.
          <br />
          연합팀의 모든 도전을 현장 중계로 연결합니다.
        </p>
        <div className={styles.launchActions}>
          <button
            className={styles.primaryButton}
            disabled={busy || available !== true}
            onClick={() => void create(false)}
          >
            {busy ? "이벤트 준비 중…" : "새 이벤트 만들기 ↗"}
          </button>
          <button
            className={styles.secondaryButton}
            disabled={busy || available !== true}
            onClick={() => void create(true)}
          >
            연습 이벤트 열기
          </button>
        </div>
        {available === false && (
          <div className={styles.serverNotice}>
            <strong>현장 운영 서버를 실행해 주세요.</strong>
            <p>
              프로젝트 폴더에서 <code>npm run dev:event</code>를 실행한 뒤 이
              화면을 새로고침하세요.
            </p>
            <p>운영·출력 화면은 같은 노트북의 서버를 사용합니다.</p>
          </div>
        )}
        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}
        <div className={styles.launchGames}>
          <article>
            <span>01 / BONUS GAME</span>
            <h2>슈팅왕</h2>
            <p>남자 1명 + 여자 1명</p>
            <b>
              100<small>POINTS</small>
            </b>
          </article>
          <article>
            <span>02 / MAIN EVENT</span>
            <h2>공 살리기</h2>
            <p>여섯 명이 만드는 하나의 기록</p>
            <b>
              1,000<small>POINTS</small>
            </b>
          </article>
        </div>
      </div>
      {recent.length > 0 && (
        <section className={styles.recentEvents}>
          <h2>이어서 운영하기</h2>
          {recent.map((e) => (
            <Link key={e.id} href={`/events/alliance/${e.id}/control`}>
              <span>{e.demo ? "REHEARSAL" : "EVENT"}</span>
              <strong>{e.title}</strong>
              <b>운영 데스크 →</b>
            </Link>
          ))}
        </section>
      )}
      <footer className={styles.launchFooter}>
        FAIR PLAY. REAL CONNECTION.<span>FAIRGROUND ALLIANCE CHALLENGE</span>
      </footer>
    </main>
  );
}
