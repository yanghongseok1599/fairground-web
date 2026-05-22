import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseServer, isDemoMode } from "@/lib/supabase-server";

const BASE = "https://fairground-footsal.vercel.app";
const FALLBACK: Metadata = {
  title: "공지사항 — FairGround",
  description: "FairGround 공지사항",
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  if (isDemoMode) return FALLBACK;
  const { id } = await params;
  const { data } = await supabaseServer
    .from("notices")
    .select("title, body")
    .eq("id", id)
    .maybeSingle();
  if (!data) return FALLBACK;

  const excerpt = (data.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `${BASE}/notices/${id}`;

  return {
    title: `${data.title} — FairGround`,
    description: excerpt || "FairGround 공지사항",
    alternates: { canonical: url },
    openGraph: {
      title: data.title,
      description: excerpt || "FairGround 공지사항",
      url,
      siteName: "FairGround",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: excerpt || "FairGround 공지사항",
    },
  };
}

export default function NoticeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
