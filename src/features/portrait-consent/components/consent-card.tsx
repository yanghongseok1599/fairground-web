"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { PortraitConsentField } from "./consent-field";
import { hasPortraitConsent, PORTRAIT_CONSENT_REQUIRED } from "../policy";

export function PortraitConsentCard() {
  const { player } = useAuth();
  return player ? <ConsentCard key={player.id} /> : null;
}

function ConsentCard() {
  const { user, player, updatePlayer } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  if (!user || !player || user.uid !== player.id) return null;
  const agreed = hasPortraitConsent(player);

  const agree = async () => {
    if (!checked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await updatePlayer({ portraitConsentAt: Date.now() });
      const saved = useAuthStore.getState();
      if (saved.user?.uid !== user.uid || !hasPortraitConsent(saved.player)) {
        throw new Error("동의 저장을 확인하지 못했습니다. 다시 시도해주세요.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "동의 저장에 실패했습니다. 다시 시도해주세요.");
    } finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <section id="portrait-consent" aria-label="초상권 동의" className="w-full scroll-mt-24 rounded-2xl border border-border bg-background p-5 text-foreground">
      <h2 className="flex items-center gap-2 text-base font-bold">
        {agreed ? <Check className="h-5 w-5 text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
        {agreed ? "초상권 동의 완료" : "초상권·촬영물 활용 동의"}
      </h2>
      {agreed ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          동의일: {new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(player.portraitConsentAt)} (한국 시간)
        </p>
      ) : (
        <>
          <p className="my-3 text-sm text-muted-foreground">{PORTRAIT_CONSENT_REQUIRED}</p>
          <PortraitConsentField checked={checked} onChange={setChecked} disabled={busy} />
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => void agree()} disabled={!checked || busy}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "동의 저장 중..." : "동의하고 저장"}
          </button>
        </>
      )}
    </section>
  );
}
