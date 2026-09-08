"use client";

import { useEffect, useRef, useState } from "react";
import { readDraft, removeDraft, writeDraft } from "@/lib/registration/draft-storage";

/** Per-account and per-tab drafts. Do not pass passwords or authentication tokens. */
export function useFormDraft<T extends object>(key: string | null, value: T, restore: (draft: T) => void) {
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  const restoreRef = useRef(restore);
  const shapeRef = useRef(value);
  const clearedKey = useRef<string | null>(null);
  const hydratedKey = useRef<string | null>(null);
  useEffect(() => { restoreRef.current = restore; });

  useEffect(() => {
    hydratedKey.current = null;
    if (!key) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      clearedKey.current = null;
      try {
        const draft = readDraft<T>(sessionStorage, key, Date.now(), shapeRef.current);
        if (draft) {
          restoreRef.current(draft);
          setMessage("작성 중이던 입력을 복원했습니다. 내용을 확인하고 저장해주세요.");
        }
      } catch {
        setStorageFailed(true);
        setMessage("이 브라우저에서는 임시보관을 사용할 수 없습니다. 저장이 확인될 때까지 화면을 닫지 마세요.");
      }
      hydratedKey.current = key;
      setReadyKey(key);
    });
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => {
    if (!key || readyKey !== key || hydratedKey.current !== key || clearedKey.current === key) return;
    try { writeDraft(sessionStorage, key, value); }
    catch {
      queueMicrotask(() => {
        setStorageFailed(true);
        setMessage("임시보관 공간이 부족합니다. 입력과 사진은 현재 화면에 유지되니 저장 전 화면을 닫지 마세요.");
      });
    }
  }, [key, readyKey, value]);

  useEffect(() => {
    if (!key || !storageFailed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [key, storageFailed]);

  const clear = () => {
    if (!key) return;
    clearedKey.current = key;
    try { removeDraft(sessionStorage, key); } catch { /* A saved server record remains authoritative. */ }
    setMessage("");
  };

  return { ready: !key || readyKey === key, message, clear };
}
