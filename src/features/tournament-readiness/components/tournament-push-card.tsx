"use client";

import Link from "next/link";
import { BellRing, Check, Loader2 } from "lucide-react";
import type { TournamentPush } from "../hooks/use-tournament-push";

export function TournamentPushCard({ push, required = false, compact = false }: {
  push: TournamentPush;
  required?: boolean;
  compact?: boolean;
}) {
  const { state, ios, busy, error } = push;
  const on = state === "on";
  const buttonClass = "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50";
  return (
    <section id="tournament-notifications" aria-label="대회 진행 알림 설정" className={`scroll-mt-24 rounded-2xl border border-border bg-background text-foreground ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold">
          {on ? <Check className="h-5 w-5 shrink-0 text-primary" /> : <BellRing className="h-5 w-5 shrink-0 text-primary" />}
          대회 진행 알림 {required && <span className="text-xs text-primary">필수</span>}
        </h3>
        <span role="status" className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {state === "loading" ? "확인 중" : on ? "ON" : state === "error" ? "확인 필요" : "OFF"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {on ? "이 기기에 대회 알림이 설정되었습니다. 대회 당일에도 알림을 켜두세요." : "대회 현장의 경기 호출, 일정 변경, 진행 공지를 휴대폰 알림으로 전달합니다. 참가자는 알림을 꼭 켜주세요."}
      </p>
      {on && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">다른 휴대폰으로 참가하면 그 기기에서도 설정해주세요. 휴대폰의 집중 모드·알림 소리 설정도 확인해주세요.</p>}
      {state === "install" && (
        <div className="mt-3 rounded-xl bg-muted p-4 text-sm leading-relaxed">
          <p className="font-bold">아이폰·아이패드는 홈 화면에 추가해주세요</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Safari에서 FairGround를 열어주세요.</li>
            <li>공유 → 홈 화면에 추가를 누르세요. ‘웹 앱으로 열기’가 보이면 켜두세요.</li>
            <li>추가한 아이콘으로 접속해 이 화면에서 알림을 켜주세요.</li>
          </ol>
          <p className="mt-2 text-muted-foreground">입력한 선수 정보는 임시 저장됩니다. 홈 화면 앱에서 보이지 않으면 기존 브라우저로 돌아와 확인해주세요.</p>
        </div>
      )}
      {state === "denied" && <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-relaxed">
        <strong>알림이 차단되어 있습니다.</strong>{" "}
        {ios ? "아이폰·아이패드 설정 → 알림 → FairGround에서 ‘알림 허용’을 켠 뒤 돌아와주세요." : "브라우저의 사이트 설정 → 알림에서 이 사이트를 ‘허용’으로 변경한 뒤 돌아와주세요."}
      </p>}
      {state === "unsupported" && <div className="mt-3 rounded-xl bg-muted p-4 text-sm leading-relaxed">
        <p>이 브라우저에서는 알림을 켤 수 없습니다. 카카오톡·인스타그램 안에서 열었다면 외부 브라우저로 열어주세요. 최신 Chrome 또는 Safari에서 다시 확인해주세요.</p>
        <p className="mt-2">알림 설정이 어려우면 현장 운영진에게 알려주시고, <Link className="font-bold text-primary underline" href="/tournaments">경기 일정</Link>과 <Link className="font-bold text-primary underline" href="/notices">공지사항</Link>을 직접 확인해주세요.</p>
        {required && <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 font-bold">
          <input type="checkbox" checked={push.fallbackAcknowledged} onChange={(event) => push.setFallbackAcknowledged(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
          이 기기에서 알림을 받을 수 없어, 운영진에게 알리고 경기 진행을 직접 확인하겠습니다.
        </label>}
      </div>}
      {state === "error" && <p role="alert" className="mt-3 text-sm text-destructive">알림 상태를 확인하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {state === "off" && <button type="button" onClick={() => void push.enable()} disabled={busy} className={buttonClass}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "알림 설정 중..." : "대회 알림 ON으로 설정"}
      </button>}
      {["denied", "unsupported", "install", "error"].includes(state) && <button type="button" disabled={busy} onClick={() => void push.refresh()} className={buttonClass}>알림 상태 다시 확인</button>}
      {state === "loading" && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />이 기기의 알림 설정을 확인하고 있습니다.</p>}
      {on && !required && <details className="mt-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer py-2">알림 설정 관리</summary>
        <p>알림을 끄면 경기 호출과 일정 변경을 놓칠 수 있습니다.</p>
        <button type="button" disabled={busy} onClick={() => void push.disable()} className="mt-2 min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">{busy ? "변경 중..." : "이 기기의 알림 끄기"}</button>
      </details>}
    </section>
  );
}
