import type { Metadata } from "next";
import {
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site-config";

// Versioned filename avoids stale previews in Kakao/OG debugger caches.
export const DEFAULT_OG_IMAGE = "/og-image-futsal-shoes-v2.png";

export const CORE_SEO_KEYWORDS = [
  "풋살대회",
  "혼성풋살대회",
  "여자풋살대회",
  "남자풋살대회",
  "전국풋살대회",
  "아마추어 풋살대회",
  "풋살 대회 참가 신청",
  "풋살 리그",
  "풋살 경기 일정",
  "풋살 팀 모집",
  "풋살 팀 가입",
  "풋살 순위",
  "풋살 랭킹",
  "풋살 선수",
  "FA선수",
  "풋살 선수카드",
  "풋살 기록",
  "실시간 스코어",
  "경기 기록",
  "팀 운영",
  "페어그라운드",
  "FairGround",
];

export const DEFAULT_SEO_DESCRIPTION =
  "FairGround는 풋살대회, 혼성풋살대회, 여자풋살대회, 남자풋살대회 일정과 참가 신청, 팀 가입, 실시간 스코어, 선수 기록, 선수카드를 한곳에서 관리하는 아마추어 풋살 플랫폼입니다.";

export const DEFAULT_SEO_OTHER = {
  "format-detection": "telephone=no",
  language: "ko-KR",
  coverage: "대한민국",
  distribution: "global",
  rating: "general",
  "geo.region": "KR",
  "geo.placename": "대한민국",
  "application-name": SITE_NAME,
  "apple-mobile-web-app-title": SITE_NAME,
  "msapplication-TileColor": "#0047AB",
  "search-target":
    "풋살대회, 혼성풋살대회, 여자풋살대회, 남자풋살대회, 풋살 리그, 풋살 선수카드",
};

type MetadataInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

type JsonLd = Record<string, unknown>;

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}

export function mergeKeywords(keywords: string[] = []) {
  return Array.from(new Set([...keywords, ...CORE_SEO_KEYWORDS]));
}

export function createSeoMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  image = DEFAULT_OG_IMAGE,
  imageWidth = 1200,
  imageHeight = 630,
  imageAlt,
  type = "website",
  publishedTime,
  modifiedTime,
}: MetadataInput): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteUrl(image);

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        "ko-KR": url,
        ko: url,
      },
    },
    keywords: mergeKeywords(keywords),
    openGraph: {
      type,
      locale: "ko_KR",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: imageWidth,
          height: imageHeight,
          alt: imageAlt ?? title,
        },
      ],
      ...(type === "article" && {
        publishedTime,
        modifiedTime,
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    other: DEFAULT_SEO_OTHER,
  };
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: ["페어그라운드", "FairGround Futsal"],
    url: SITE_URL,
    email: SITE_CONTACT_EMAIL,
    logo: absoluteUrl("/favicon-192.png?v=2"),
    description:
      "풋살대회, 팀 운영, 실시간 경기 기록, 선수카드를 연결하는 아마추어 스포츠 플랫폼",
    areaServed: {
      "@type": "Country",
      name: "대한민국",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITE_CONTACT_EMAIL,
      availableLanguage: ["Korean", "English"],
    },
    knowsAbout: [
      "풋살대회",
      "혼성풋살대회",
      "여자풋살대회",
      "남자풋살대회",
      "풋살 팀 운영",
      "풋살 선수 기록",
    ],
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "페어그라운드",
    url: SITE_URL,
    inLanguage: "ko-KR",
    description: DEFAULT_SEO_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/players")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function webApplicationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    inLanguage: "ko-KR",
    description: DEFAULT_SEO_DESCRIPTION,
    featureList: [
      "풋살대회 일정 확인",
      "혼성풋살대회·여자풋살대회·남자풋살대회 참가 신청",
      "팀 가입 및 팀 운영",
      "실시간 스코어와 개인 스탯 기록",
      "선수카드 생성과 공유",
      "랭킹과 FA선수 탐색",
    ],
    areaServed: {
      "@type": "Country",
      name: "대한민국",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function collectionPageJsonLd({
  name,
  description,
  path,
  keywords = [],
}: {
  name: string;
  description: string;
  path: string;
  keywords?: string[];
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: absoluteUrl(path),
    inLanguage: "ko-KR",
    description,
    keywords: mergeKeywords(keywords).join(", "),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    about: [
      "풋살대회",
      "혼성풋살대회",
      "여자풋살대회",
      "남자풋살대회",
      "풋살 리그",
      "풋살 선수카드",
    ],
  };
}

export function faqPageJsonLd(
  questions: Array<{ question: string; answer: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function sportsEventJsonLd({
  name,
  description,
  path,
  startDate,
  endDate,
  locationName,
  address,
  image = DEFAULT_OG_IMAGE,
  eventStatus = "https://schema.org/EventScheduled",
  eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode",
  offers,
}: {
  name: string;
  description: string;
  path: string;
  startDate: string;
  endDate?: string;
  locationName: string;
  address: string;
  image?: string;
  eventStatus?: string;
  eventAttendanceMode?: string;
  offers?: JsonLd;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name,
    description,
    url: absoluteUrl(path),
    image: absoluteUrl(image),
    startDate,
    ...(endDate ? { endDate } : {}),
    eventStatus,
    eventAttendanceMode,
    sport: ["Beach Soccer", "Futsal", "Soccer"],
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    location: {
      "@type": "Place",
      name: locationName,
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressRegion: "강원특별자치도",
        addressLocality: "동해시",
        streetAddress: address,
      },
    },
    ...(offers ? { offers } : {}),
  };
}
