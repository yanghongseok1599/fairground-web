"use client";

import { MapPin, MessageCircle } from "lucide-react";
import type { Tournament } from "@/types";
import { SITE_URL } from "@/lib/site-config";
import { getTournamentDisplayName } from "@/features/tournaments/public-fixtures";
import { getChannelChatUrl, getTournamentShareUrl, getVenueSearchUrl } from "../links";
import { EventShareButton } from "./share-button";

export function TournamentActions({ tournament }: { tournament: Tournament }) {
  const mapUrl = getVenueSearchUrl(tournament.location);
  const channelUrl = getChannelChatUrl(process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL);
  const linkClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10";
  return <div className="mt-6 flex flex-wrap items-start gap-3 text-white">
    <EventShareButton content={{ title: getTournamentDisplayName(tournament), description: [tournament.date, tournament.location].filter(Boolean).join(" · "), url: getTournamentShareUrl(SITE_URL, tournament.id) }} />
    {mapUrl && <a className={linkClass} href={mapUrl} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" aria-hidden="true" />경기장 찾기</a>}
    {channelUrl && <a className={linkClass} href={channelUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true" />카카오톡 문의</a>}
  </div>;
}
