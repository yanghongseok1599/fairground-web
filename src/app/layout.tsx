import type { Metadata, Viewport } from "next";
import { Outfit, Noto_Sans_KR, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-noto",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const siteUrl = "https://fairground.kr"; // ← 배포 도메인으로 교체

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FairGround - 모두가 승리하는 풋살 페스티벌",
    template: "%s | FairGround",
  },
  description:
    "풋살 리그 실시간 통합 플랫폼. 실시간 경기 스코어, 나만의 선수 카드, 리그 순위, 팀 관리까지 한곳에서. Play Your Growth!",
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
    title: "FairGround - 모두가 승리하는 풋살 페스티벌",
    description:
      "실시간 경기 스코어, 나만의 선수 카드, 리그 순위를 한곳에서. Play Your Growth!",
    siteName: "FairGround",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "FairGround - 모두가 승리하는 풋살 페스티벌",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FairGround - 모두가 승리하는 풋살 페스티벌",
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
  themeColor: "#0D1B2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${outfit.variable} ${notoSansKR.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen bg-fg-white antialiased">
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
