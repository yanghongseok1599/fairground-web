/** Prepare the current client-only recorder document and its already loaded chunks. */
export function prepareOfflineShell(): () => void {
  if (!("serviceWorker" in navigator)) return () => {};
  let disposed = false;
  const prepare = () => {
    if (disposed) return;
    const assets = [...new Set(performance.getEntriesByType("resource").map(entry => entry.name).filter(name => {
      const url = new URL(name);
      return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
    }))];
    navigator.serviceWorker.controller?.postMessage({ type: "PREPARE_RECORDING_SHELL", assets });
  };
  prepare();
  void navigator.serviceWorker.ready.then(prepare).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", prepare);
  return () => { disposed = true; navigator.serviceWorker.removeEventListener("controllerchange", prepare); };
}
