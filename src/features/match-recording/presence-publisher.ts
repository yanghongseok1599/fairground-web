export interface QueuePresencePayload { name: string; pending: number; blockingPending: number; queueRevision: number }

/** Only one track is in flight; failed acknowledgements retry the latest durable queue state. */
export function createPresencePublisher(send: (payload: QueuePresencePayload) => Promise<string>, timers = {
  schedule: (callback: () => void, delay: number) => setTimeout(callback, delay),
  cancel: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
}) {
  let latest: QueuePresencePayload | undefined;
  let desired = 0;
  let acknowledged = 0;
  let active = false;
  let closed = false;
  let sending = false;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const clearRetry = () => { if (retry !== undefined) timers.cancel(retry); retry = undefined; };
  const flush = async () => {
    if (sending || retry !== undefined || closed || !active) return;
    sending = true;
    try {
      while (!closed && active && latest && desired > acknowledged) {
        const version = desired;
        let result: string;
        try { result = await send({ ...latest }); } catch { result = "error"; }
        if (closed) return;
        if (result !== "ok") {
          if (active) {
            const delay = Math.min(5000, 1000 * 2 ** Math.min(failures++, 3));
            retry = timers.schedule(() => { retry = undefined; void flush(); }, delay);
          }
          return;
        }
        failures = 0;
        acknowledged = version;
      }
    } finally { sending = false; }
  };
  return {
    set(payload: QueuePresencePayload) {
      if (closed) return;
      if (latest && payload.pending === latest.pending && payload.blockingPending === latest.blockingPending && payload.queueRevision === latest.queueRevision && payload.name === latest.name) return;
      latest = { ...payload }; desired++; void flush();
    },
    setActive(value: boolean) {
      if (closed) return;
      active = value; clearRetry();
      if (value) { desired++; void flush(); }
    },
    close() { closed = true; active = false; clearRetry(); },
  };
}
