import { clampMatchElapsedSeconds } from "@/lib/match-config";

export interface ClockSnapshot {
  elapsedSeconds: number;
  currentHalf: 1 | 2;
  isRunning: boolean;
}

// Polling can return the last persisted second while this device has already
// advanced. Only a pause/resume or period change may reset that local anchor.
export function reconcileClock(
  elapsed: number,
  previous: ClockSnapshot | null,
  incoming: ClockSnapshot,
): number {
  const continuous = previous?.isRunning && incoming.isRunning &&
    previous.currentHalf === incoming.currentHalf;
  return clampMatchElapsedSeconds(continuous
    ? Math.max(elapsed, incoming.elapsedSeconds)
    : incoming.elapsedSeconds);
}
