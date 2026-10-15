"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PortraitConsentField } from "./consent-field";
import { hasPortraitConsent } from "../policy";

/** [선택] 초상 홍보 이용 동의 상태 + 동의·철회. 동의 여부와 무관하게 선수카드는 그대로 쓸 수 있다. */
export function PortraitConsentCard() {
  const { player } = useAuth();
  return player ? <ConsentCard key={player.id} /> : null;
}

function ConsentCard() {
  const { user, player, setPortraitConsent } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  if (!user || !player || user.uid !== player.id) return null;
  const agreed = hasPortraitConsent(player);

  const save = async (granted: boolean) => {
    if (inFlight.current || (granted && !checked)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await setPortraitConsent(granted);
      setChecked(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다. 다시 시도해주세요.");
    } finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <section id="portrait-consent" aria-label="초상권 홍보 이용 동의" className="w-full scroll-mt-24 rounded-2xl border border-border bg-background p-5 text-foreground">
      <h2 className="flex items-center gap-2 text-base font-bold">
        {agreed ? <Check className="h-5 w-5 text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
        {agreed ? "홍보 이용 동의함 (선택)" : "홍보 이용 동의 (선택)"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        동의하지 않아도 선수카드와 대회 참가는 그대로 이용할 수 있습니다. 선수카드와 경기 기록은 서비스 화면에 표시됩니다.
      </p>
      {agreed ? (
        <>
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            동의일: {new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(player.portraitConsentAt)} (한국 시간)
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            철회하면 새로 홍보에 쓰지 않고, 이미 올린 홍보 게시물은 운영진이 내리거나 가립니다. 선수카드는 지워지지 않습니다.
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => void save(false)} disabled={busy}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "철회 저장 중..." : "동의 철회"}
          </button>
        </>
      ) : (
        <>
          <div className="mt-3"><PortraitConsentField checked={checked} onChange={setChecked} disabled={busy} /></div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <button type="button" onClick={() => void save(true)} disabled={!checked || busy}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "동의 저장 중..." : "동의하고 저장"}
          </button>
        </>
      )}
    </section>
  );
}
