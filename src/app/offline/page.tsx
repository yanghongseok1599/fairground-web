import type { Metadata } from "next";
import { OfflineRetry } from "./offline-retry";

export const metadata: Metadata = {
  title: "오프라인",
  description: "네트워크 연결이 끊어졌습니다.",
  robots: { index: false, follow: false },
};

/**
 * 오프라인 폴백 페이지 — 커스텀 SW(public/sw.js)가 document 요청 실패 시 제공.
 * app-shell(헤더/푸터) 안에서 렌더되며, 브랜드키트 CSS 변수만 사용(하드코딩 hex 금지).
 * 정적 prerender 가능(서버 컴포넌트). 재시도 버튼만 클라이언트 컴포넌트로 분리.
 */
export default function OfflinePage() {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "var(--background)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: "var(--color-fg-paper-3)" }}
        aria-hidden="true"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-fg-blue)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 13a10 10 0 0 1 5.24-2.76" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h1
        className="mt-6 text-2xl font-bold"
        style={{ color: "var(--color-fg-ink)" }}
      >
        오프라인 상태입니다
      </h1>

      <p
        className="mt-2 max-w-sm text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        네트워크 연결이 끊어졌습니다. 실시간 스코어·순위는 연결 복구 후 표시됩니다.
        이미 방문한 페이지는 계속 이용할 수 있습니다.
      </p>

      <OfflineRetry />
    </div>
  );
}
