"use client";

import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { PortraitConsentReminder } from "@/features/portrait-consent/components/consent-reminder";
import { SwRegister } from "./sw-register";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Event output has its own chrome: no site navigation, install prompts or auth popups on air.
  if (
    pathname === "/events/alliance" ||
    pathname.startsWith("/events/alliance/")
  )
    return <>{children}</>;
  return (
    <Providers>
      <SwRegister />
      <SiteHeader />
      <main className="pt-[60px] w-full overflow-x-clip"><PortraitConsentReminder />{children}</main>
      <SiteFooter />
    </Providers>
  );
}
