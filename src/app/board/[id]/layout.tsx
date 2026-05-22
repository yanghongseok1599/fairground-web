import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseServer, isDemoMode } from "@/lib/supabase-server";

const BASE = "https://fairground-footsal.vercel.app";
const FALLBACK: Metadata = {
  title: "FairGround",
  description: "모두가 승리하는 그라운드",
};

type ProfileRel = { name?: string | null } | Array<{ name?: string | null }> | null;

function pickAuthorName(rel: ProfileRel): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name ?? undefined;
  return rel.name ?? undefined;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  if (isDemoMode) return FALLBACK;
  const { id } = await params;
  const { data } = await supabaseServer
    .from("board_posts")
    .select("title, body, is_hidden, profiles:author_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.is_hidden) return FALLBACK;

  const author = pickAuthorName(data.profiles as ProfileRel);
  const excerpt = (data.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `${BASE}/board/${id}`;

  return {
    title: `${data.title} — FairGround`,
    description: excerpt || "FairGround 자유게시판",
    alternates: { canonical: url },
    openGraph: {
      title: data.title,
      description: excerpt || "FairGround 자유게시판",
      url,
      siteName: "FairGround",
      type: "article",
      authors: author ? [author] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: excerpt || "FairGround 자유게시판",
    },
  };
}

export default function BoardPostLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
