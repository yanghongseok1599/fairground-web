import type { Metadata } from "next";
import type { ReactNode } from "react";
import { supabaseServer, isDemoMode } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/site-config";

const FALLBACK: Metadata = {
  title: "선수 — FairGround",
  description: "FairGround 선수 프로필",
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  if (isDemoMode) return FALLBACK;
  const { id } = await params;
  const { data } = await supabaseServer
    .from("public_player_profiles")
    .select("name, number, position, bio, photo_url, profile_photo_url, profile_photo_locked, is_approved, is_banned")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.is_approved || data.is_banned) return FALLBACK;

  const numText = typeof data.number === "number" ? `#${data.number}` : "";
  const titleBase = [numText, data.name].filter(Boolean).join(" ");
  const positionText = typeof data.position === "string" ? data.position : "";
  const bioClean = (data.bio ?? "").replace(/\s+/g, " ").trim();
  const desc = (bioClean || `${positionText} ${data.name} — FairGround 선수`).slice(0, 160);
  const url = `${SITE_URL}/players/${id}`;

  const photo = data.profile_photo_locked && data.profile_photo_url
    ? data.profile_photo_url
    : data.photo_url ?? data.profile_photo_url ?? "";
  const image = typeof photo === "string" && photo.startsWith("https://") ? photo : undefined;

  return {
    title: `${titleBase || "선수"} — FairGround`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: titleBase || data.name,
      description: desc,
      url,
      siteName: "FairGround",
      type: "profile",
      images: image ? [{ url: image, alt: `${data.name} 프로필 사진` }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: titleBase || data.name,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}

export default function PlayerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
