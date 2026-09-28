/** Shared by the in-app inbox and the push dispatcher. Never derive routes from message text. */
export interface NotificationTarget {
  kind: string;
  matchId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  teamId?: string | null;
}

export function notificationTarget(n: NotificationTarget): string {
  if (n.matchId) return `/matches/${encodeURIComponent(n.matchId)}`;
  if (n.postId && n.commentId) return `/board/${encodeURIComponent(n.postId)}#cm-${encodeURIComponent(n.commentId)}`;
  if (n.postId) return `/board/${encodeURIComponent(n.postId)}`;
  if (n.kind === "team_notice" && n.teamId) return `/teams/${encodeURIComponent(n.teamId)}/notices`;
  if (n.kind === "tier_promoted" || n.kind === "coach_approved") return "/my";
  if (n.kind === "player_approved" || n.kind === "team_role_changed") return n.teamId ? `/teams/${encodeURIComponent(n.teamId)}` : "/my";
  if (n.kind === "match_ready" || n.kind === "admin_broadcast") return "/live";
  if (n.teamId) return `/teams/${encodeURIComponent(n.teamId)}`;
  return "/";
}

export interface PushNotificationRecord {
  id?: string;
  user_id: string;
  kind: string;
  title: string;
  snippet?: string | null;
  match_id?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  team_id?: string | null;
}

export function notificationPushPayload(n: PushNotificationRecord) {
  return {
    title: n.title,
    body: n.snippet ?? "",
    url: notificationTarget({ kind: n.kind, matchId: n.match_id, postId: n.post_id, commentId: n.comment_id, teamId: n.team_id }),
    kind: n.kind,
    notificationId: n.id,
  };
}
