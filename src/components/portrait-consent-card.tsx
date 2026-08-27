"use client";

import { useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * 촬영물 홍보 활용 동의 카드 — 기존 선수 대상.
 *
 * 동의 문항은 선수카드 등록(/my/player-setup)과 대회 참가 신청에 들어가 있지만,
 * 그 이전에 이미 카드를 만든 선수들은 두 화면을 다시 거치지 않아 동의 기록이
 * 남지 않는다(도입 시점 기준 40명). 이 카드가 그 공백을 메운다.
 *
 * profiles.portrait_consent_at 이 비어 있는 동안에만 뜨고, 동의하면 사라진다.
 *
 * "나중에"로 닫을 수 있게 둔 건 의도적이다. 동의는 자유로운 의사로 받아야
 * 효력이 있어서, 닫을 수 없는 카드로 사실상 강제하면 동의의 임의성이 깨진다.
 * 닫아도 다음 방문에 다시 뜬다(그 방문 동안만 숨김).
 */

const DISMISS_KEY = "fg_portrait_consent_dismissed";

export function PortraitConsentCard() {
  const { player, updatePlayer } = useAuth();
  const [busy, setBusy] = useState(false);
  const [justAgreed, setJustAgreed] = useState(false);
  const [failed, setFailed] = useState("");
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const shell = "w-full rounded-2xl p-5";
  const box = {
    background: "var(--color-fg-paper)",
    border: "1px solid var(--color-fg-line-soft)",
  };

  if (justAgreed) {
    return (
      <div className={shell} style={box}>
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
            촬영물 활용에 동의해 주셔서 감사합니다
          </h3>
        </div>
        <p
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          동의 시각이 기록되었습니다.
        </p>
      </div>
    );
  }

  // 이미 동의했거나(=기록 있음), 로그인 전이거나, 이번 방문에 닫은 경우 숨김.
  if (!player || player.portraitConsentAt || dismissed) return null;

  const agree = async () => {
    setBusy(true);
    setFailed("");
    try {
      await updatePlayer({ portraitConsentAt: Date.now() });
      setJustAgreed(true);
    } catch {
      setFailed("동의 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 저장이 막혀도 이 방문 동안 숨기는 것까지는 동작해야 한다.
    }
    setDismissed(true);
  };

  return (
    <div className={shell} style={box}>
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4" style={{ color: "var(--primary)" }} />
        <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
          현장 촬영물 활용 동의가 필요합니다
        </h3>
      </div>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: "var(--color-fg-ink-muted)" }}
      >
        대회·행사 현장에서 촬영되는 사진·영상에 본인이 등장할 수 있으며, 해당
        촬영물이 FairGround의 홍보·마케팅 목적(온라인 채널·광고·인쇄물 등 상업적
        이용 포함)으로 기간과 횟수의 제한 없이 사용되는 것에 동의합니다. 이에
        대해 별도의 대가나 초상권을 주장하지 않습니다.
      </p>

      {failed && (
        <p
          role="alert"
          className="mt-3 text-[13px] font-bold"
          style={{ color: "var(--destructive)" }}
        >
          {failed}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void agree()}
          disabled={busy}
          className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
          style={{ background: "var(--primary)", color: "var(--color-fg-paper)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "저장 중..." : "동의합니다"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="inline-flex min-h-[46px] items-center justify-center rounded-xl px-4 text-sm font-bold transition-opacity disabled:opacity-60"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            color: "var(--color-fg-ink-muted)",
          }}
        >
          나중에
        </button>
      </div>
    </div>
  );
}
