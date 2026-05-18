"use client";

import { MessageSquare } from "lucide-react";

export interface BoardComment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  teamName?: string;
  content: string;
  createdAt: number;
}

export interface BoardPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  teamName?: string;
  createdAt: number;
  likes?: Record<string, boolean>;
  confirms?: Record<string, boolean>;
}

type WriteRole = "admin" | "any" | "team";

// 공개 인터페이스 보존: 호출 페이지(notices/board/teams/[id]) 시그니처 무파손.
// demoPosts 는 더 이상 렌더하지 않음(S7: 가짜데이터 제거). 게시판 데이터는
// 현재 Supabase 스키마에 테이블이 없으므로 정직한 "준비 중" 빈 상태로 표시.
interface BoardPageProps {
  pageTitle: string;
  pageSubtitle: string;
  label: string;
  accentColor: string;
  dbPath: string;
  writeRole: WriteRole;
  demoPosts?: BoardPost[];
  showTeamBadge?: boolean;
  requiredTeamId?: string;
  hideHeader?: boolean;
}

export function BoardPage({
  pageTitle,
  pageSubtitle,
  label,
  accentColor,
  hideHeader,
}: BoardPageProps) {
  return (
    <div
      className={hideHeader ? "" : "pt-[60px] min-h-screen"}
      style={{ background: hideHeader ? "var(--secondary)" : "var(--foreground)" }}
    >
      {/* Page header */}
      {!hideHeader && (
        <div className="py-16 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
          <div className="max-w-4xl mx-auto">
            <p
              className="text-[11px] uppercase tracking-[3px] mb-4"
              style={{ fontFamily: "var(--font-space-mono)", color: accentColor }}
            >
              {label}
            </p>
            <h1
              className="font-black leading-none mb-2"
              style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "clamp(36px, 6vw, 64px)",
                letterSpacing: "-2px",
                color: "var(--background)",
              }}
            >
              {pageTitle}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
              {pageSubtitle}
            </p>
          </div>
        </div>
      )}

      {/* Board body — honest empty state (게시판 백엔드 미연동) */}
      <div style={{ background: "var(--secondary)" }}>
        <div className="px-4 md:px-8 py-16 max-w-3xl mx-auto">
          <div
            className="flex flex-col items-center justify-center gap-4 py-20 rounded-2xl text-center"
            style={{ background: "var(--background)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${accentColor}1A`, color: accentColor }}
            >
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="font-bold text-base" style={{ color: "var(--foreground)" }}>
              게시판 준비 중입니다
            </p>
            <p
              className="text-sm max-w-sm leading-relaxed"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              게시판 기능은 아직 연동되지 않았습니다. 곧 이용하실 수 있도록 준비
              중입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
