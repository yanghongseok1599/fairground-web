"use client";

import { useEffect, useRef, useState } from "react";
import { loadSurveyResponses, SurveyResultsAccessError } from "./client";
import type { SurveyResponse } from "./model";

/** Mounted only after the route's approved-admin guard grants access. */
export function useSurveyResults() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    void loadSurveyResponses().then((next) => {
      if (version !== requestVersion.current) return;
      setResponses(next);
      setLoadedAt(new Date().toISOString());
    }).catch((cause: unknown) => {
      if (version !== requestVersion.current) return;
      if (cause instanceof SurveyResultsAccessError) {
        setResponses([]);
        setLoadedAt(null);
      }
      setError(cause instanceof Error ? cause.message : "설문 결과를 불러오지 못했습니다. 다시 시도해 주세요.");
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
    return () => { requestVersion.current += 1; };
  }, []);

  async function refresh() {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadSurveyResponses();
      if (version !== requestVersion.current) return;
      setResponses(next);
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      if (version !== requestVersion.current) return;
      if (cause instanceof SurveyResultsAccessError) {
        setResponses([]);
        setLoadedAt(null);
      }
      setError(cause instanceof Error ? cause.message : "설문 결과를 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }

  return { responses, loading, error, loadedAt, refresh };
}
