"use client";

import { useEffect, useRef, useState } from "react";
import {
  createEmptySurveyAnswers,
  CATEGORY_ITEMS, ROLE_OPTIONS, RETURN_INTENT_OPTIONS, RULES_OPINION_OPTIONS,
  MATCH_DURATION_OPTIONS, ENTRY_FEE_OPTIONS, TEXT_MAX_LENGTH,
  parseSurveySubmission,
  validateSurveyAnswers,
  type SurveyAnswers,
  type SurveyField,
} from "./model";

const STORAGE_KEY = "fairground-festival-survey-v1";
type Errors = Partial<Record<SurveyField, string>>;
type Envelope = { responseId: string; answers: SurveyAnswers };
type StoredSurvey = { answers: SurveyAnswers; pending: Envelope | null; submitted: boolean };

function readStoredSurvey(): StoredSurvey | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSurvey;
    const empty = createEmptySurveyAnswers();
    if (!stored.answers || typeof stored.answers !== "object") return null;
    // Rebuild from known keys so old browser drafts cannot introduce fields
    // that participants have no way to correct in the current questionnaire.
    const choiceOptions = { role: ROLE_OPTIONS, returnIntent: RETURN_INTENT_OPTIONS, rulesOpinion: RULES_OPINION_OPTIONS, matchDuration: MATCH_DURATION_OPTIONS, entryFee: ENTRY_FEE_OPTIONS };
    for (const key of Object.keys(choiceOptions) as (keyof typeof choiceOptions)[]) {
      const value = stored.answers[key];
      if (choiceOptions[key].some((option) => option.value === value)) Object.assign(empty, { [key]: value });
    }
    for (const key of ["overallSatisfaction", "recommendation"] as const) {
      const value = stored.answers[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= (key === "recommendation" ? 0 : 1) && value <= (key === "recommendation" ? 10 : 5)) empty[key] = value;
    }
    for (const { key } of CATEGORY_ITEMS) {
      const value = stored.answers.categoryRatings?.[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) empty.categoryRatings[key] = value;
    }
    for (const key of ["bestMoment", "improvement", "safetyIncident", "suggestions"] as const) {
      const value = stored.answers[key];
      if (typeof value === "string") empty[key] = value.slice(0, TEXT_MAX_LENGTH);
    }
    const parsed = stored.pending ? parseSurveySubmission(stored.pending) : null;
    return { answers: empty, pending: parsed?.success ? parsed.value : null, submitted: stored.submitted === true };
  } catch {
    return null;
  }
}

function persistSurvey(value: StoredSurvey): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Submitting remains possible when browser storage is disabled.
  }
}

export function useSurvey() {
  const [answers, setAnswers] = useState<SurveyAnswers>(createEmptySurveyAnswers);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<Envelope | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    // Read only after hydration so server and client render the same first frame.
    const timer = window.setTimeout(() => {
      const stored = readStoredSurvey();
      if (stored) {
        setAnswers(stored.pending?.answers ?? stored.answers);
        setPending(stored.pending);
        setSubmitted(stored.submitted === true);
        if (stored.pending) setMessage("이전에 전송한 응답을 확인하지 못했습니다. 아래 버튼으로 다시 전송해 주세요.");
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) persistSurvey({ answers, pending, submitted });
  }, [answers, pending, submitted, ready]);

  function update<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key as SurveyField];
      if (key === "categoryRatings") {
        for (const { key: category } of CATEGORY_ITEMS) {
          if ((value as SurveyAnswers["categoryRatings"])[category] !== answers.categoryRatings[category]) delete next[`categoryRatings.${category}`];
        }
      }
      return next;
    });
  }

  async function submit() {
    if (requestInFlight.current || submitted || !ready) return;
    const parsed = validateSurveyAnswers(answers);
    if (!parsed.success) {
      setErrors(parsed.errors);
      setMessage("아직 답하지 않은 필수 문항을 확인해 주세요.");
      const first = Object.keys(parsed.errors)[0];
      const target = document.getElementById(first.startsWith("categoryRatings.") ? "categoryRatings" : first);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      return;
    }

    // Persist the exact envelope before sending. A response lost in transit can
    // be retried after refresh without inserting a second anonymous response.
    const envelope = pending ?? { responseId: crypto.randomUUID(), answers: parsed.value };
    requestInFlight.current = true;
    setPending(envelope);
    setSubmitting(true);
    setErrors({});
    setMessage("");
    persistSurvey({ answers: envelope.answers, pending: envelope, submitted: false });
    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(20_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        if (response.status === 400 || response.status === 422) {
          setPending(null);
          persistSurvey({ answers, pending: null, submitted: false });
          if (result?.errors) setErrors(result.errors);
        }
        throw new Error(result?.error || "응답을 전송하지 못했습니다. 잠시 후 다시 전송해 주세요.");
      }
      persistSurvey({ answers: createEmptySurveyAnswers(), pending: null, submitted: true });
      setAnswers(createEmptySurveyAnswers());
      setPending(null);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message
        : "연결이 원활하지 않습니다. 작성한 응답은 보관 중이니 다시 전송해 주세요.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return { answers, errors, update, submit, pending, submitting, submitted, message, ready };
}
