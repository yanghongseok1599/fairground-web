"use client";

/** Discard only the failed attempt; leave the last valid photo and form intact. */
export function PlayerCardPhotoError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="mt-3 max-w-[280px] text-center text-sm">
      <p role="alert" className="text-red-600">{message}</p>
      <button type="button" onClick={onDismiss} className="mt-2 rounded-xl border px-4 py-2 font-bold" style={{ color: "var(--primary)", borderColor: "var(--primary)" }}>
        실패한 사진 선택 취소
      </button>
      <p className="mt-1 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>이전 사진과 작성한 내용은 유지됩니다.</p>
    </div>
  );
}
