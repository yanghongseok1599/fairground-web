"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { elementToPngBlob } from "@/lib/card-download";

type PreparedElementPng = {
  blob: Blob | null;
  error: Error | null;
  isPreparing: boolean;
  retry: () => void;
};

/**
 * Pre-renders an element so permission-gated mobile APIs can be called directly
 * from the eventual button tap instead of after a slow canvas render.
 */
export function usePreparedElementPng<T extends HTMLElement>(
  elementRef: RefObject<T | null>,
  revision: string,
  enabled = true,
): PreparedElementPng {
  const generationRef = useRef(0);
  const [retryCount, setRetryCount] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [preparedRequest, setPreparedRequest] = useState("");
  const requestKey = `${revision}\u0000${retryCount}`;

  const retry = useCallback(() => {
    setRetryCount((current) => current + 1);
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;

    if (!enabled) return;

    const frameId = window.requestAnimationFrame(() => {
      const element = elementRef.current;
      if (!element) {
        if (generation === generationRef.current) {
          setBlob(null);
          setError(new Error("저장할 카드 화면을 찾지 못했습니다."));
          setPreparedRequest(requestKey);
        }
        return;
      }

      void elementToPngBlob(element)
        .then((nextBlob) => {
          if (generation !== generationRef.current) return;
          setBlob(nextBlob);
          setError(null);
          setPreparedRequest(requestKey);
        })
        .catch((cause: unknown) => {
          if (generation !== generationRef.current) return;
          setBlob(null);
          setError(
            cause instanceof Error
              ? cause
              : new Error("카드 이미지를 준비하지 못했습니다."),
          );
          setPreparedRequest(requestKey);
        });
    });

    return () => {
      generationRef.current += 1;
      window.cancelAnimationFrame(frameId);
    };
  }, [elementRef, enabled, requestKey]);

  const hasCurrentRequest = preparedRequest === requestKey;
  return {
    blob: enabled && hasCurrentRequest ? blob : null,
    error: enabled && hasCurrentRequest ? error : null,
    isPreparing: enabled && !hasCurrentRequest,
    retry,
  };
}
