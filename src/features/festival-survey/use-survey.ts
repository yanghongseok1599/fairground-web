"use client";

import { useEffect, useRef, useState } from "react";
import {
  createEmptySurveyAnswers,
  CATEGORY_ITEMS,
  validateSurveyAnswers,
  type SurveyAnswers,
  type SurveyField,
  type SurveySubmission,
} from "./model";
import { persistSurvey, readStoredSurvey } from "./draft-storage";
import { readPendingSubmissions, removePendingSubmission, writePendingSubmission } from "./pending-storage";

type Errors = Partial<Record<SurveyField, string>>;

function storageWarning(durable: boolean, session: boolean): string {
  if (durable) return "";
  return session
    ? "이 브라우저에서는 탭을 닫은 뒤 응답을 복구할 수 없습니다. 제출 완료가 표시될 때까지 이 탭을 닫지 말아 주세요."
    : "이 브라우저에서는 응답을 임시 저장할 수 없습니다. 제출 완료가 표시될 때까지 새로고침하거나 이 탭을 닫지 말아 주세요.";
}

export function useSurvey() {
  const [answers, setAnswers] = useState<SurveyAnswers>(createEmptySurveyAnswers);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<SurveySubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const requestInFlight = useRef(false);
  const answersRef = useRef(answers);
  const confirmedResponseIds = useRef<string[]>([]);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    // Read only after hydration so server and client render the same first frame.
    const timer = window.setTimeout(() => {
      const stored = readStoredSurvey();
      confirmedResponseIds.current = stored?.confirmedResponseIds ?? [];
      // A different tab's pending packet must never replace this participant's
      // unfinished draft. Recover shared packets when this tab has no own work.
      const hasOwnDraft = stored && !stored.submitted
        && JSON.stringify(stored.answers) !== JSON.stringify(createEmptySurveyAnswers());
      const ownPending = stored?.pending && !confirmedResponseIds.current.includes(stored.pending.responseId) ? stored.pending : null;
      const recovered = ownPending ?? (hasOwnDraft ? null : readPendingSubmissions().find((item) => !confirmedResponseIds.current.includes(item.responseId)) ?? null);
      const restoredAnswers = recovered?.answers ?? stored?.answers ?? createEmptySurveyAnswers();
      answersRef.current = restoredAnswers;
      setAnswers(restoredAnswers);
      setPending(recovered);
      setSubmitted(!recovered && stored?.submitted === true);
      if (recovered) {
        const durable = writePendingSubmission(recovered);
        const session = persistSurvey({ answers: recovered.answers, pending: recovered, submitted: false, confirmedResponseIds: confirmedResponseIds.current });
        setWarning(storageWarning(durable, session));
        setMessage("이전에 전송한 응답을 확인하지 못했습니다. 아래 버튼으로 다시 전송해 주세요.");
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) persistSurvey({ answers, pending, submitted, confirmedResponseIds: confirmedResponseIds.current });
  }, [answers, pending, submitted, ready]);

  function update<K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) {
    const nextAnswers = { ...answersRef.current, [key]: value };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    // Save during the input event, before a tab close can interrupt an effect.
    persistSurvey({ answers: nextAnswers, pending, submitted, confirmedResponseIds: confirmedResponseIds.current });
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
    const parsed = validateSurveyAnswers(answersRef.current);
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
    const durable = writePendingSubmission(envelope);
    const session = persistSurvey({ answers: envelope.answers, pending: envelope, submitted: false, confirmedResponseIds: confirmedResponseIds.current });
    setWarning(storageWarning(durable, session));
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
        // Keep the immutable packet on every failed receipt, including a
        // rejection. No transport or server error may silently discard answers.
        if (result?.errors) setErrors(result.errors);
        throw new Error(result?.error || "응답을 전송하지 못했습니다. 잠시 후 다시 전송해 주세요.");
      }
      removePendingSubmission(envelope);
      // Preserve this tab's server receipts even if browser cleanup is blocked.
      // Fresh tabs can still safely confirm the same UUID with the server.
      if (!confirmedResponseIds.current.includes(envelope.responseId)) confirmedResponseIds.current.push(envelope.responseId);
      const next = readPendingSubmissions().find((item) => !confirmedResponseIds.current.includes(item.responseId)) ?? null;
      const nextAnswers = next?.answers ?? createEmptySurveyAnswers();
      const saved = persistSurvey({ answers: nextAnswers, pending: next, submitted: !next, confirmedResponseIds: confirmedResponseIds.current });
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      setPending(next);
      setSubmitted(!next);
      setWarning(next ? storageWarning(writePendingSubmission(next), saved) : "");
      setMessage(next ? "응답 한 건이 제출되었습니다. 보관 중인 다른 응답도 아래 버튼으로 전송해 주세요." : "");
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" && error.name !== "TypeError"
        ? error.message
        : "연결이 원활하지 않습니다. 제출이 확인되지 않았습니다. 아래 버튼으로 다시 전송해 주세요.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  return { answers, errors, update, submit, pending, submitting, submitted, message, ready, storageWarning: warning };
}
