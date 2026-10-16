const chromiumTerminationGraceMs = 30_000;

/** Bound the owned runner process, never a user's browser or a process group. */
export function armBrowserWatchdog(child, {
  engine,
  timeoutMs = 180_000,
  onTimeout = () => {},
  onForceTermination = () => {},
} = {}) {
  if (!['chromium', 'ego'].includes(engine)) throw new Error('Unknown browser watchdog engine.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new Error('Browser watchdog timeout must be a positive timer duration.');
  }
  let cancelled = false;
  let terminationTimer;
  const timeoutTimer = setTimeout(() => {
    if (cancelled) return;
    if (engine === 'chromium') {
      terminationTimer = setTimeout(() => {
        if (cancelled) return;
        cancel();
        // SIGKILL skips Node's exit handlers. Sending this signal does not
        // establish that Playwright's browser or temporary profile was cleaned.
        const signalSent = child.kill('SIGKILL');
        onForceTermination({ signal: 'SIGKILL', signalSent, cleanupConfirmed: false });
      }, chromiumTerminationGraceMs);
    }
    try {
      onTimeout();
    } finally {
      child.kill('SIGTERM');
    }
  }, timeoutMs);

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(timeoutTimer);
    clearTimeout(terminationTimer);
    child.off('close', cancel);
    child.off('error', cancel);
  }

  child.once('close', cancel);
  child.once('error', cancel);
  return cancel;
}
