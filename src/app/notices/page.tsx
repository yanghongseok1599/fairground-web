"use client";

import { BoardPage } from "@/components/board-page";

export default function NoticesPage() {
  return (
    <BoardPage
      pageTitle="공지사항"
      pageSubtitle="운영진의 공식 공지를 확인하세요"
      label="Notices"
      accentColor="var(--accent-gold)"
      dbPath="notices"
      writeRole="admin"
    />
  );
}
