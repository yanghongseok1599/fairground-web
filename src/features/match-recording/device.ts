let cached: string | undefined;
export function recordingDeviceId(): string {
  if (cached) return cached;
  const key = "fg-recording-device-id";
  const existing = localStorage.getItem(key);
  cached = existing || crypto.randomUUID();
  if (!existing) localStorage.setItem(key, cached);
  return cached;
}
