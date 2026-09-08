"use client";

import { useRef, useState } from "react";

/** Synchronous lock also blocks a second click before React has rendered disabled. */
export function useSubmission() {
  const locked = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const begin = () => {
    if (locked.current) return false;
    locked.current = true;
    setSubmitting(true);
    return true;
  };
  const end = () => { locked.current = false; setSubmitting(false); };
  return { submitting, begin, end };
}
