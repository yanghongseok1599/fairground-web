/** iOS requires persistent notifications from the installed app's service worker. */
export async function showDeviceNotification(title: string): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  try {
    if (Notification.permission !== "granted") return false;
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration?.active) {
        await registration.showNotification(title, {
          icon: "/icons/icon-192.png",
          badge: "/icons/badge-96.png",
          data: { url: "/my" },
        });
        return true;
      }
    }
    // Older desktop browsers may only support the constructor. Mobile exceptions
    // are contained here so a notification cannot interrupt the current page.
    new Notification(title);
    return true;
  } catch {
    return false;
  }
}
