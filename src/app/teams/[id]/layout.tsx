import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseServer, isDemoMode } from "@/lib/supabase-server";
import { TeamAdminLayout } from "@/components/team-admin-layout";
import { SITE_URL } from "@/lib/site-config";

const FALLBACK: Metadata = {
  title: "팀 — FairGround",
  description: "FairGround 팀 페이지",
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  if (isDemoMode) return FALLBACK;
  const { id } = await params;
  const { data } = await supabaseServer
    .from("teams")
    .select("name, description, logo, is_approved")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.is_approved) return FALLBACK;

  const desc = (data.description ?? `${data.name} — FairGround 풋살팀`).replace(/\s+/g, " ").trim().slice(0, 160);
  const url = `${SITE_URL}/teams/${id}`;
  // logo는 HTTPS 절대 URL일 때만 OG image로 채택 (data: 또는 상대경로 회피).
  const image = typeof data.logo === "string" && data.logo.startsWith("https://") ? data.logo : undefined;

  return {
    title: `${data.name} — FairGround`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: data.name,
      description: desc,
      url,
      siteName: "FairGround",
      type: "profile",
      images: image ? [{ url: image, alt: `${data.name} 로고` }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: data.name,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TeamLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeamAdminLayout teamId={id}>{children}</TeamAdminLayout>;
}
