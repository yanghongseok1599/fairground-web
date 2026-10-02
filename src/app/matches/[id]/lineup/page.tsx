import { redirect } from "next/navigation";

/** 기존 출전 명단 제출 주소는 경기 상세로 연결한다. */
export default async function MatchLineupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/matches/${encodeURIComponent(id)}`);
}
