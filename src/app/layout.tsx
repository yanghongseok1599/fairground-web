import type { Metadata, Viewport } from "next";
import { Oswald, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { SwRegister } from "@/components/sw-register";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const siteUrl = "https://fairground.kr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FairGround — Where Amateurs Play Pro",
    template: "%s | FairGround",
  },
  description:
    "서울 유일의 아마추어 풋살 리그. 실시간 스코어, 개인 스탯, FIFA 스타일 선수 카드까지 — 경기장 밖에서도 프로처럼.",
  alternates: {
    canonical: siteUrl,
    languages: { ko: `${siteUrl}/` },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "FairGround — Where Amateurs Play Pro",
    description:
      "실시간 경기 스코어, 나만의 선수 카드, 리그 순위를 한곳에서. Play Your Growth!",
    siteName: "FairGround",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "FairGround — Where Amateurs Play Pro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FairGround — Where Amateurs Play Pro",
    description: "풋살 리그 실시간 통합 플랫폼. Play Your Growth!",
    images: [`${siteUrl}/og-image.png`],
  },
  keywords: ["풋살", "FairGround", "페어그라운드", "풋살리그", "선수카드", "실시간스코어"],
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  category: "sports",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${oswald.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* Pretendard via official CDN — Google Fonts에 없음 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <style>{`:root { --font-pretendard: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif; }`}</style>
      </head>
      <body className="min-h-screen antialiased fg-grain">
        <Providers>
          <SwRegister />
          <SiteHeader />
          <main className="pt-[60px]">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
