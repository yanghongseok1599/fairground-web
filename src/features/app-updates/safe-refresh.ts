/** Automatic refresh is limited to read-only routes; recording/editing never reloads. */
export function canRefreshApp(pathname: string) {
  return pathname === "/" || pathname === "/admin/matches" || pathname === "/live" || pathname === "/standings" ||
    pathname === "/leaderboard" || pathname === "/about" || /^\/(tournaments|teams|players)(\/[^/]+)?\/?$/.test(pathname);
}

export function hasOpenEditor(document: Document) {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"], input:focus, textarea:focus, [contenteditable="true"]:focus');
}
