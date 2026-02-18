"use client";

import { BoardPage, type BoardPost } from "@/components/board-page";

const DEMO_POSTS: BoardPost[] = [
  {
    id: "n1",
    title: "2025 시즌 일정 안내",
    content: "안녕하세요. 2025 페어그라운드 풋살 리그 시즌 일정을 안내드립니다.\n\n▪ 개막전: 2025년 3월 1일\n▪ 정규 라운드: 3월 ~ 10월 (매주 토요일)\n▪ 플레이오프: 11월\n▪ 결승전: 11월 30일\n\n각 팀은 홈구장 배정 일정을 별도 공지로 확인해 주시기 바랍니다.\n참가 신청은 앱을 통해 진행하세요.",
    authorId: "admin",
    authorName: "운영진",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "n2",
    title: "선수 등록 마감 안내 (3/15까지)",
    content: "2025 시즌 선수 등록 마감은 3월 15일입니다.\n\n기한 내 등록하지 않은 선수는 첫 2경기 출전이 제한됩니다. 앱 내 [내 프로필] → [팀 등록 요청]을 통해 등록해 주세요.\n\n문의: fairground.official@gmail.com",
    authorId: "admin",
    authorName: "운영진",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "n3",
    title: "경기장 이용 규정 업데이트",
    content: "경기장 이용 관련 규정이 일부 업데이트되었습니다.\n\n✔ 경기 시작 20분 전 필수 도착\n✔ 유니폼 미착용 시 출전 불가\n✔ 경기장 내 음주 금지\n✔ 부상 발생 시 즉시 운영진에게 신고\n\n위 규정 위반 시 해당 경기 몰수패 처리됩니다.",
    authorId: "admin",
    authorName: "운영진",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
  },
];

export default function NoticesPage() {
  return (
    <BoardPage
      pageTitle="공지사항"
      pageSubtitle="운영진의 공식 공지를 확인하세요"
      label="Notices"
      accentColor="#FFD700"
      dbPath="notices"
      writeRole="admin"
      demoPosts={DEMO_POSTS}
    />
  );
}
