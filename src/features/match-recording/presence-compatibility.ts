import { version as realtimeVersion } from "@supabase/realtime-js/package.json";

type Callback = (this: unknown, ...args: unknown[]) => unknown;
const patched = Symbol.for("fairground.recordingPresenceClone.2.105.4");
const record = (value: unknown): Record<PropertyKey, unknown> | undefined =>
  value !== null && typeof value === "object" ? value as Record<PropertyKey, unknown> : undefined;

/**
 * realtime-js 2.105.4's Phoenix adapter deletes phx_ref from live presence metadata
 * while creating join/leave event payloads. Clone only those callback arguments so
 * later updates and departures can still match the original Phoenix references.
 * This private adapter layout is version-scoped and covered by installed-SDK tests;
 * re-evaluate/remove this compatibility layer when upgrading realtime-js.
 */
export function protectRecordingPresenceReferences(channel: unknown): boolean {
  if (realtimeVersion !== "2.105.4") return false;
  const presence = record(record(record(record(channel)?.presence)?.presenceAdapter)?.presence);
  const caller = record(presence?.caller);
  if (!presence || !caller || typeof presence.onJoin !== "function" || typeof presence.onLeave !== "function"
    || typeof caller.onJoin !== "function" || typeof caller.onLeave !== "function") return false;
  if (presence[patched]) return true;

  const cloneArguments = (original: Callback): Callback => function (...args) {
    return original.apply(this, args.map((value, index) => index === 0 ? value : structuredClone(value)));
  };
  presence.onJoin.call(presence, cloneArguments(caller.onJoin as Callback));
  presence.onLeave.call(presence, cloneArguments(caller.onLeave as Callback));
  presence[patched] = true;
  return true;
}
