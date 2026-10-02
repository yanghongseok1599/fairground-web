import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedMatchResult } from "@/features/match-share/server/result";
import { getMatchShareLinks } from "@/features/match-share/links";
import { getTournamentShareUrl } from "@/features/kakao-tools/links";
import { createSeoMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const result = await getSharedMatchResult((await params).id);
  if (!result) notFound();
  const links = getMatchShareLinks(SITE_URL, result.id, result.homeScore, result.awayScore);
  return createSeoMetadata({ title: result.title, description: `${result.tournamentName} · R${result.round} · 경기 종료`, path: new URL(links.url).pathname, image: links.imageUrl, imageAlt: result.title });
}

export default async function MatchResultSharePage({ params }: Props) {
  const result = await getSharedMatchResult((await params).id);
  if (!result) notFound();
  return <main className="mx-auto max-w-2xl px-5 pb-16 pt-28">
    <section className="rounded-2xl bg-[#0D1B2A] px-6 py-10 text-center text-white">
      <p className="text-sm text-blue-200">{result.tournamentName} · R{result.round}</p>
      <h1 className="mt-6 text-lg font-bold">경기 종료</h1>
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <span className="break-all text-xl font-bold">{result.home}</span>
        <strong className="whitespace-nowrap text-5xl">{result.homeScore} : {result.awayScore}</strong>
        <span className="break-all text-xl font-bold">{result.away}</span>
      </div>
      <Link className="mt-10 inline-flex min-h-11 items-center rounded-lg bg-white px-5 font-bold text-[#0D1B2A]" href={getTournamentShareUrl(SITE_URL, result.tournamentId, result.id)}>대회·경기 보기</Link>
    </section>
  </main>;
}
