"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerProfilePhoto } from "@/components/player-profile-photo";
import { fetchApprovalPhoto } from "@/features/admin-players/api";
import { inspectionNumber } from "../policy";
import type { InspectionPlayer } from "../types";

export function InspectionDialog({ player, tournamentName, saving, error, onClose, onConfirm }: {
  player: InspectionPlayer;
  tournamentName: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [photo, setPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoLoading, setPhotoLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const cancel = Boolean(player.checked_at);
  useEffect(() => {
    const controller = new AbortController();
    void fetchApprovalPhoto(player.player_id, controller.signal)
      .then((url) => { if (!controller.signal.aborted) setPhoto(url); })
      .catch(() => { if (!controller.signal.aborted) setPhotoError("사진을 불러오지 못했습니다. 현장에서 본인 확인 후 진행해주세요."); })
      .finally(() => { if (!controller.signal.aborted) setPhotoLoading(false); });
    return () => controller.abort();
  }, [player.player_id]);

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent showCloseButton={!saving} className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{cancel ? "검인 완료 취소" : "선수 본인 확인"}</DialogTitle>
        <DialogDescription>{tournamentName}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
        <PlayerProfilePhoto src={photo} alt={`${player.name} 선수 사진`} className="h-24 w-20 rounded-xl" />
        <div>
          <p className="text-xl font-black">{player.name} <span className="text-primary">#{inspectionNumber(player)}</span></p>
          <p className="mt-1 text-sm">{player.team_name}</p>
          <p className="mt-1 text-sm text-muted-foreground">생년월일 {player.birth_date || "미등록"}</p>
        </div>
      </div>
      {photoLoading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />사진 불러오는 중</p>
        : <p className="text-xs text-muted-foreground">{photoError || (!photo ? "등록된 사진이 없습니다. 현장에서 본인 확인 후 진행해주세요." : "등록 사진과 현장 선수의 본인 여부를 확인해주세요.")}</p>}
      {cancel ? <p className="text-sm">{player.name} 선수를 미검인 상태로 되돌립니다. 참가자 마이페이지에도 반영됩니다.</p>
        : <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm font-bold">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={saving} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          선수 본인과 참가 자격을 현장에서 확인했습니다.
        </label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={onClose} className="min-h-11 flex-1 rounded-xl border px-3 text-sm font-bold disabled:opacity-50">닫기</button>
        <button type="button" disabled={saving || (!cancel && !confirmed) || Boolean(error)} onClick={onConfirm}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "저장 중…" : cancel ? "검인 취소 확인" : "검인 완료 처리"}
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}
