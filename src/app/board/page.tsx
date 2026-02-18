"use client";

import { BoardPage, type BoardPost } from "@/components/board-page";

const DEMO_POSTS: BoardPost[] = [
  {
    id: "b1",
    title: "이번 주 토요일 합동 연습 같이 하실 분?",
    content: "안녕하세요! 저희 팀이 이번 주 토요일 오후 2시에 연습 예정인데, 인원이 좀 부족해서요.\n\n참가 원하시는 분은 댓글 남겨주시거나 DM 주세요. 선착순 3명입니다.\n\n장소: 홍대 실내 풋살장 B코트",
    authorId: "u1",
    authorName: "박상훈",
    createdAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "b2",
    title: "GK 포지션 훈련 꿀팁 공유합니다",
    content: "골키퍼 포지션 뛰고 계신 분들을 위해 제가 써먹는 훈련 방법 공유합니다.\n\n1. 반응속도 훈련: 파트너와 1m 거리에서 벽에 공 튀기기\n2. 발 기술: 킥인 상황 반복 연습 (스트롱사이드, 위크사이드)\n3. 배치: 니어포스트 지키면서 앵글 줄이기\n\n궁금한 거 있으면 언제든 질문하세요!",
    authorId: "u2",
    authorName: "김도현",
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "b3",
    title: "지난 시즌 결승전 돌아보며",
    content: "작년 결승전 정말 명경기였죠. 연장 끝에 승부차기까지 가는 거 보면서 이 리그가 많이 성장했다는 게 느껴졌어요.\n\n올 시즌도 기대됩니다. 우리 팀도 열심히 준비하고 있으니 다들 잘 부탁드려요!",
    authorId: "u3",
    authorName: "이준혁",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "b4",
    title: "추천 풋살화 뭐가 좋나요?",
    content: "실내 풋살화 새로 구매하려고 하는데 추천 좀 부탁드려요. 예산은 10~15만원 사이고, 발이 좀 넓은 편입니다.\n\n현재 후보:\n- 나이키 팬텀 GX2 IC\n- 아디다스 코파 퓨어.2 IN\n- 퓨마 킹 얼티메이트 IT\n\n써보신 분 있으면 후기 공유 부탁드립니다!",
    authorId: "u4",
    authorName: "최서연",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
];

export default function FreeBoardPage() {
  return (
    <BoardPage
      pageTitle="자유게시판"
      pageSubtitle="리그 참가자 누구나 자유롭게 소통하는 공간입니다"
      label="Free Board"
      accentColor="#00C853"
      dbPath="freeBoard"
      writeRole="any"
      demoPosts={DEMO_POSTS}
    />
  );
}
