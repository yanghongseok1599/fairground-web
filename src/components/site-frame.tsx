"use client";

import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PortraitConsentReminder } from "@/features/portrait-consent/components/consent-reminder";
import { RecordingSyncService } from "@/features/match-recording/sync-service";
import { SwRegister } from "./sw-register";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Public event pages have their own chrome and do not initialize member services.
  if (
    pathname === "/survey" ||
    pathname.startsWith("/survey/") ||
    pathname === "/events/alliance" ||
    pathname.startsWith("/events/alliance/")
  )
    return <>{children}</>;
  return (
    <Providers>
      <SwRegister />
      <RecordingSyncService />
      <SiteHeader />
      <main className="w-full overflow-x-clip"><PortraitConsentReminder />{children}</main>
      <SiteFooter />
    </Providers>
  );
}
