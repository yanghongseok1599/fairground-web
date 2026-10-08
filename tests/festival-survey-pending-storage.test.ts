import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptySurveyAnswers, parseSurveySubmission } from "../src/features/festival-survey/model.ts";
import type { SurveySubmission } from "../src/features/festival-survey/model.ts";
import { PENDING_STORAGE_PREFIX, readPendingSubmissions, removePendingSubmission, writePendingSubmission } from "../src/features/festival-survey/pending-storage.ts";
import type { PendingStorage } from "../src/features/festival-survey/pending-storage.ts";

class MemoryStorage implements PendingStorage {
  readonly values = new Map<string, string>();
  writes = 0;
  removes: string[] = [];
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.removes.push(key); this.values.delete(key); }
}
function submission(index = 1): SurveySubmission {
  const result = parseSurveySubmission({ responseId: `abcdefab-cdef-4123-8abc-${String(index).padStart(12, "0")}`, answers: {
    ...createEmptySurveyAnswers(), role: "player", overallSatisfaction: 5, recommendation: 0, returnIntent: "probably",
    categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
    rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate", bestMoment: "  즐거운 경기  ", improvement: "없음",
  } });
  assert.ok(result.success);
  if (!result.success) throw Error("Invalid test fixture");
  return result.value;
}

test("different attempts coexist and resolving one receipt preserves all other attempts and application storage", () => {
  const storage = new MemoryStorage();
  storage.values.set("fairground-match-recording-v1", "preserve actual match queue");
  storage.values.set("member-setting", "preserve unrelated setting");
  const first = submission(1), second = submission(2);
  assert.equal(writePendingSubmission(first, storage), true);
  assert.equal(writePendingSubmission(second, storage), true);
  assert.equal(readPendingSubmissions(storage).length, 2);
  assert.equal(removePendingSubmission(first, storage), true);
  assert.deepEqual(readPendingSubmissions(storage), [second]);
  assert.equal(storage.getItem("fairground-match-recording-v1"), "preserve actual match queue");
  assert.equal(storage.getItem("member-setting"), "preserve unrelated setting");
  assert.deepEqual(storage.removes, [PENDING_STORAGE_PREFIX + first.responseId]);
});

test("a retry with the same canonical UUID and answers is idempotent and never rewrites the record", () => {
  const storage = new MemoryStorage();
  const value = submission();
  assert.equal(writePendingSubmission(value, storage), true);
  const key = PENDING_STORAGE_PREFIX + value.responseId;
  const before = storage.getItem(key);
  const normalizedRetry = { responseId: value.responseId.toUpperCase(), answers: { ...value.answers, bestMoment: "\t즐거운 경기\u3000" } };
  assert.equal(writePendingSubmission(normalizedRetry, storage), true);
  assert.equal(storage.writes, 1);
  assert.equal(storage.getItem(key), before);
  assert.deepEqual(readPendingSubmissions(storage), [value]);
});

test("different answers under an existing UUID cannot overwrite or resolve its pending record", () => {
  const storage = new MemoryStorage();
  const value = submission();
  assert.equal(writePendingSubmission(value, storage), true);
  const before = storage.getItem(PENDING_STORAGE_PREFIX + value.responseId);
  const conflict = { ...value, answers: { ...value.answers, recommendation: 10 } };
  assert.equal(writePendingSubmission(conflict, storage), false);
  assert.equal(removePendingSubmission(conflict, storage), false);
  assert.equal(storage.getItem(PENDING_STORAGE_PREFIX + value.responseId), before);
  assert.equal(storage.writes, 1);
  assert.deepEqual(storage.removes, []);
});

test("recovery sorts older records first, validates canonical answers and preserves malformed records", () => {
  const storage = new MemoryStorage();
  const first = submission(1), second = submission(2);
  storage.values.set(PENDING_STORAGE_PREFIX + second.responseId, JSON.stringify({ version: 1, createdAt: 20, submission: second }));
  storage.values.set(PENDING_STORAGE_PREFIX + first.responseId, JSON.stringify({ version: 1, createdAt: 10, submission: first }));
  const malformed = ["not-json", JSON.stringify({ version: 2, createdAt: 1, submission: submission(3) }),
    JSON.stringify({ version: 1, createdAt: -1, submission: submission(4) }),
    JSON.stringify({ version: 1, createdAt: 1, submission: { ...submission(5), answers: { ...submission(5).answers, memberId: "private" } } }),
    JSON.stringify({ version: 1, createdAt: 1, submission: submission(6), extra: "private" }),
    JSON.stringify({ version: 1, createdAt: 1, submission: submission(7) }),
  ];
  malformed.forEach((raw, index) => storage.values.set(PENDING_STORAGE_PREFIX + `malformed-${index}`, raw));
  const before = [...storage.values];
  assert.deepEqual(readPendingSubmissions(storage), [first, second]);
  assert.deepEqual([...storage.values], before);
  assert.equal(storage.writes, 0);
  assert.deepEqual(storage.removes, []);
});

test("a malformed record under a valid UUID is kept for recovery instead of overwritten or deleted", () => {
  const storage = new MemoryStorage();
  const value = submission();
  const key = PENDING_STORAGE_PREFIX + value.responseId;
  storage.values.set(key, "incomplete record that must be preserved");
  assert.equal(writePendingSubmission(value, storage), false);
  assert.equal(removePendingSubmission(value, storage), false);
  assert.equal(storage.getItem(key), "incomplete record that must be preserved");
});

test("invalid or identity-bearing inputs cannot enter the outbox", () => {
  const storage = new MemoryStorage();
  const value = submission();
  for (const invalid of [null, {}, { ...value, responseId: "invalid" },
    { ...value, answers: { ...value.answers, recommendation: null } }, { ...value, userId: "private" },
    { ...value, answers: { ...value.answers, teamId: "private" } }]) {
    assert.equal(writePendingSubmission(invalid as SurveySubmission, storage), false);
    assert.equal(removePendingSubmission(invalid as SurveySubmission, storage), false);
  }
  assert.equal(storage.length, 0); assert.equal(storage.writes, 0);
});

test("quota, permission and silent-write failures are reported as persistence failures", () => {
  const value = submission();
  for (const message of ["QuotaExceededError", "SecurityError"]) {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error(message); };
    assert.equal(writePendingSubmission(value, storage), false);
  }
  const unreadable = new MemoryStorage(); unreadable.getItem = () => { throw new Error("SecurityError"); };
  assert.equal(writePendingSubmission(value, unreadable), false);
  assert.equal(removePendingSubmission(value, unreadable), false);
  assert.deepEqual(readPendingSubmissions(unreadable), []);
  const ignoredWrite = new MemoryStorage(); ignoredWrite.setItem = () => {};
  assert.equal(writePendingSubmission(value, ignoredWrite), false);
  assert.equal(writePendingSubmission(value, null), false);
  assert.equal(removePendingSubmission(value, null), false);
  assert.deepEqual(readPendingSubmissions(null), []);
});

test("a detected concurrent record replacement prevents removing the other payload", () => {
  const storage = new MemoryStorage();
  const value = submission();
  assert.equal(writePendingSubmission(value, storage), true);
  const key = PENDING_STORAGE_PREFIX + value.responseId;
  const changed = JSON.stringify({ version: 1, createdAt: 20, submission: { ...value, answers: { ...value.answers, recommendation: 10 } } });
  const originalGet = storage.getItem.bind(storage);
  let reads = 0;
  storage.getItem = (requested) => {
    if (requested === key && ++reads === 2) storage.values.set(key, changed);
    return originalGet(requested);
  };
  assert.equal(removePendingSubmission(value, storage), false);
  assert.equal(originalGet(key), changed);
  assert.deepEqual(storage.removes, []);
});

test("another tab can resolve the same exact receipt without global clears or orphaned attempts", () => {
  const storage = new MemoryStorage();
  const first = submission(1), second = submission(2);
  assert.equal(writePendingSubmission(first, storage), true);
  assert.equal(writePendingSubmission(second, storage), true);
  assert.equal(removePendingSubmission(first, storage), true);
  assert.equal(removePendingSubmission(first, storage), true);
  assert.deepEqual(readPendingSubmissions(storage), [second]);
});

test("failed receipt removal reports failure and preserves the pending envelope for idempotent recovery", () => {
  const storage = new MemoryStorage();
  const value = submission();
  assert.equal(writePendingSubmission(value, storage), true);
  storage.removeItem = () => { throw new Error("SecurityError"); };
  assert.equal(removePendingSubmission(value, storage), false);
  assert.deepEqual(readPendingSubmissions(storage), [value]);
});

test("the default browser storage getter is guarded when a browser blocks localStorage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { throw new Error("SecurityError"); },
  } });
  try {
    assert.equal(writePendingSubmission(submission()), false);
    assert.equal(removePendingSubmission(submission()), false);
    assert.deepEqual(readPendingSubmissions(), []);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
