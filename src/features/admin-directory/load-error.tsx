"use client";

export function AdminLoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return <div role="alert" className="space-y-3 p-6 text-center text-sm">
    <p className="font-bold text-destructive">목록을 불러오지 못했습니다.</p>
    <p className="text-muted-foreground">{error}</p>
    <button type="button" onClick={onRetry} className="min-h-11 rounded-md bg-primary px-4 font-bold text-primary-foreground">다시 시도</button>
  </div>;
}
