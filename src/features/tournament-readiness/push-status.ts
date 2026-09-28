import { hasSavedPushSubscription } from "@/lib/push";
import { getPushEnvironment } from "./push-environment";
import type { TournamentPushState } from "./policy";

export type PushPermission = NotificationPermission | "unavailable";

/** Permission belongs to this execution context; delivery also needs an account subscription. */
export async function readTournamentPushStatus(userId?: string) {
  const environment = getPushEnvironment();
  let permission: PushPermission = "unavailable";
  let state: TournamentPushState;
  try {
    if (environment.needsInstall) state = "install";
    else if (!environment.supported) state = "unsupported";
    else {
      permission = Notification.permission;
      if (permission === "denied") state = "denied";
      else if (permission !== "granted") state = "off";
      else state = userId && await hasSavedPushSubscription(userId) ? "on" : "unlinked";
    }
  } catch {
    state = "error";
  }
  return { state, permission, environment };
}
