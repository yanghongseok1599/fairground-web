export const DRAFT_PREFIX = "fg_form_draft_v1:";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function readDraft<T>(storage: Storage, key: string, now = Date.now(), shape?: T): T | null {
  const raw = storage.getItem(DRAFT_PREFIX + key);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || !Number.isFinite(saved.at) || now - saved.at > MAX_AGE) {
    storage.removeItem(DRAFT_PREFIX + key);
    return null;
  }
  if (!saved.value || typeof saved.value !== "object") throw new Error("보관된 입력 형식이 올바르지 않습니다.");
  if (shape && Object.entries(shape).some(([field, example]) => {
    const value = saved.value[field];
    if (Array.isArray(example)) return !Array.isArray(value) || value.some((item) => typeof item !== "string");
    return typeof value !== typeof example || (typeof value === "number" && !Number.isFinite(value));
  })) throw new Error("보관된 입력 형식이 올바르지 않습니다.");
  return saved.value as T;
}

export function writeDraft<T>(storage: Storage, key: string, value: T): void {
  storage.setItem(DRAFT_PREFIX + key, JSON.stringify({ version: 1, at: Date.now(), value }));
}

export function removeDraft(storage: Storage, key: string): void {
  storage.removeItem(DRAFT_PREFIX + key);
}
