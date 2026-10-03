"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Glasses, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGlassesWaiver, signGlassesWaiver } from "../api";
import { GLASSES_WAIVER_CLAUSES, GLASSES_WAIVER_TITLE, matchesSignerName, waiverReceiptText, type GlassesWaiverReceipt } from "../policy";

export function GlassesWaiverCard() {
  const { user, player } = useAuth();
  if (!user || !player || user.uid !== player.id) return null;
  return <WaiverCard key={user.uid} name={player.name} />;
}

function WaiverCard({ name }: { name: string }) {
  const [saved, setSaved] = useState<GlassesWaiverReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signer, setSigner] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    setLoading(true);
    setError("");
    getGlassesWaiver().then((value) => { if (active) setSaved(value); })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; };
  }, [attempt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !agreed || !matchesSignerName(signer, name)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await signGlassesWaiver(signer);
      if (mounted.current) setSaved(value);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function download() {
    if (!saved) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF", waiverReceiptText(saved)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "glasses-waiver-receipt.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section id="glasses-waiver" aria-label={GLASSES_WAIVER_TITLE} className="scroll-mt-24 rounded-2xl border border-border bg-background p-5 text-foreground">
    <h2 className="flex items-center gap-2 text-base font-bold"><Glasses className="h-5 w-5 text-primary" />{GLASSES_WAIVER_TITLE}</h2>
    <p className="mt-2 text-sm text-muted-foreground">안경을 착용하고 참가하는 분은 위험 안내를 확인하고 본인 이름으로 서명해주세요.</p>
    {loading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />서약 기록 확인 중...</p> : <>
      {saved && <div role="status" className="mt-4 rounded-xl bg-primary/5 p-4 text-sm">
        <p className="flex items-center gap-2 font-bold text-primary"><CheckCircle2 className="h-5 w-5" />전자서명 완료 · {saved.signer_name}</p>
        <p className="mt-2">{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(saved.signed_at))} (한국 시간)</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">확인번호: {saved.id} · 버전: {saved.version}</p>
        <button type="button" onClick={download} className="mt-3 min-h-11 rounded-lg border border-border px-4 font-semibold">서명한 서약서 내려받기</button>
      </div>}
      <details className="mt-4 rounded-xl border border-border p-4" open={!saved}>
        <summary className="cursor-pointer font-semibold">{saved ? "서명한 서약 내용 보기" : "서약 내용"}</summary>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">{(saved?.document ?? GLASSES_WAIVER_CLAUSES).map((text, index) => <li key={index}>{text}</li>)}</ol>
      </details>
      {!saved && !error && <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
        <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-primary" />위 위험과 본인 책임 범위, 전자서명 기록 저장을 확인하고 자발적으로 동의합니다.</label>
        <div><label htmlFor="glasses-signer" className="text-sm font-semibold">전자서명 · 본인 이름</label>
          <input id="glasses-signer" value={signer} onChange={(event) => setSigner(event.target.value)} disabled={busy} autoComplete="name" maxLength={100} required aria-describedby="glasses-signer-help" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4" />
          <p id="glasses-signer-help" className="mt-2 text-sm text-muted-foreground">회원 이름 ‘{name}’을 직접 입력해주세요. 제출 후 서명 기록은 수정할 수 없습니다.</p>
        </div>
        <button type="submit" disabled={!agreed || !matchesSignerName(signer, name) || busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "서명 저장 중..." : "동의하고 전자서명 제출"}</button>
      </form>}
    </>}
    {error && <div className="mt-4"><p role="alert" className="text-sm text-destructive">{error}</p><button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)} className="mt-2 min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">저장 기록 다시 확인</button></div>}
  </section>;
}
