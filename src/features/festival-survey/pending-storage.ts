import { parseSurveySubmission } from "./model.ts";
import type { SurveySubmission } from "./model.ts";

export const PENDING_STORAGE_PREFIX = "fairground-festival-survey-pending-v1:";
export interface PendingStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
type PendingRecord = { version: 1; createdAt: number; submission: SurveySubmission };

function resolveStorage(storage?: PendingStorage | null): PendingStorage | null {
  if (storage !== undefined) return storage;
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}
function canonical(input: unknown): SurveySubmission | null {
  const result = parseSurveySubmission(input);
  return result.success ? result.value : null;
}
function sameSubmission(left: SurveySubmission, right: SurveySubmission): boolean {
  // parseSurveySubmission rebuilds all answer keys in a consistent order.
  return JSON.stringify(left) === JSON.stringify(right);
}
function parseRecord(raw: string, key: string): PendingRecord | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).length !== 3 || !["version", "createdAt", "submission"].every((field) => Object.hasOwn(record, field))
      || record.version !== 1 || typeof record.createdAt !== "number"
      || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0) return null;
    const submission = canonical(record.submission);
    if (!submission || key !== PENDING_STORAGE_PREFIX + submission.responseId) return null;
    return { version: 1, createdAt: record.createdAt, submission };
  } catch { return null; }
}

/** Store only a complete validated submission, never an unsubmitted draft or member identifier. */
export function writePendingSubmission(submission: SurveySubmission, storage?: PendingStorage | null): boolean {
  const normalized = canonical(submission);
  const target = resolveStorage(storage);
  if (!normalized || !target) return false;
  const key = PENDING_STORAGE_PREFIX + normalized.responseId;
  try {
    const existing = target.getItem(key);
    if (existing !== null) {
      const record = parseRecord(existing, key);
      // Preserve timestamps and original bytes on an idempotent retry.
      return !!record && sameSubmission(record.submission, normalized) && target.getItem(key) === existing;
    }
    const record: PendingRecord = { version: 1, createdAt: Date.now(), submission: normalized };
    const serialized = JSON.stringify(record);
    target.setItem(key, serialized);
    // Some browsers can reject or ignore writes; do not claim persistence without readback.
    return target.getItem(key) === serialized;
  } catch { return false; }
}

/** Recover oldest first. Bad records and unrelated storage keys are left untouched. */
export function readPendingSubmissions(storage?: PendingStorage | null): SurveySubmission[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const keys = new Set<string>();
    const length = target.length;
    for (let index = 0; index < length; index++) {
      const key = target.key(index);
      if (key?.startsWith(PENDING_STORAGE_PREFIX)) keys.add(key);
    }
    const records: PendingRecord[] = [];
    for (const key of keys) {
      const raw = target.getItem(key);
      if (raw === null) continue;
      const record = parseRecord(raw, key);
      if (record) records.push(record);
    }
    return records.sort((left, right) => left.createdAt - right.createdAt || left.submission.responseId.localeCompare(right.submission.responseId))
      .map((record) => record.submission);
  } catch { return []; }
}

/** Call only after the server confirms this exact envelope; never remove another attempt. */
export function removePendingSubmission(submission: SurveySubmission, storage?: PendingStorage | null): boolean {
  const normalized = canonical(submission);
  const target = resolveStorage(storage);
  if (!normalized || !target) return false;
  const key = PENDING_STORAGE_PREFIX + normalized.responseId;
  try {
    const raw = target.getItem(key);
    if (raw === null) return true; // Another tab may already have handled the same receipt.
    const record = parseRecord(raw, key);
    if (!record || !sameSubmission(record.submission, normalized)) return false;
    // localStorage has no compare-and-delete transaction. Cooperative writers use
    // immutable UUID keys; also reject a detected change before the removal.
    if (target.getItem(key) !== raw) return false;
    target.removeItem(key);
    return target.getItem(key) === null;
  } catch { return false; }
}
