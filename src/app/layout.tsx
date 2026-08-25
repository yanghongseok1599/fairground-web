import type { Metadata, Viewport } from "next";
import { Oswald, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { SwRegister } from "@/components/sw-register";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import {
  CORE_SEO_KEYWORDS,
  DEFAULT_OG_IMAGE,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_OTHER,
  absoluteUrl,
  organizationJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | 풋살대회·혼성풋살대회·여자풋살대회·남자풋살대회 플랫폼`,
    template: "%s | FairGround",
  },
  description: DEFAULT_SEO_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "ko-KR": `${SITE_URL}/`,
      ko: `${SITE_URL}/`,
    },
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
    locale: "ko_KR",
    url: SITE_URL,
    title: `${SITE_NAME} | 풋살대회·혼성풋살대회·여자풋살대회·남자풋살대회 플랫폼`,
    description: DEFAULT_SEO_DESCRIPTION,
    siteName: SITE_NAME,
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} 풋살대회 플랫폼`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | 풋살대회 플랫폼`,
    description:
      "풋살대회·혼성풋살대회·여자풋살대회·남자풋살대회 일정과 참가 신청, 선수카드, 실시간 기록을 한곳에서 관리하세요.",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  keywords: CORE_SEO_KEYWORDS,
  icons: {
    icon: [
      { url: "/favicon-16.png?v=9", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png?v=9", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192.png?v=9", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=9",
    apple: [{ url: "/apple-touch-icon.png?v=9", sizes: "180x180" }],
  },
  category: "sports",
  classification:
    "풋살대회, 혼성풋살대회, 여자풋살대회, 남자풋살대회, 아마추어 풋살 플랫폼",
  other: DEFAULT_SEO_OTHER,
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
        <SeoJsonLd
          data={[organizationJsonLd(), websiteJsonLd(), webApplicationJsonLd()]}
        />
      </head>
      <body className="min-h-screen antialiased fg-grain overflow-x-clip">
        <Providers>
          <SwRegister />
          <SiteHeader />
          <main className="pt-[60px] w-full overflow-x-clip">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
