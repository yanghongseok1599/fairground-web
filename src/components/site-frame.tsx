"use client";

import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { BusinessFooter } from "./business-footer";
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
    return (
      <>
        {children}
        {/* 자체 화면을 쓰는 행사 페이지에도 법적 고지 링크는 남긴다. */}
        <footer className="px-5 py-6"><BusinessFooter className="mx-auto max-w-3xl" /></footer>
      </>
    );
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
