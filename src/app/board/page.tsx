"use client";

import { BoardPage } from "@/components/board-page";

export default function FreeBoardPage() {
  return (
    <BoardPage
      pageTitle="자유게시판"
      pageSubtitle="리그 참가자 누구나 자유롭게 소통하는 공간입니다"
      label="Free Board"
      accentColor="var(--primary)"
      dbPath="freeBoard"
      writeRole="any"
    />
  );
}
