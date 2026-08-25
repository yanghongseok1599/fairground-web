import type { NextConfig } from "next";

const CANONICAL_HOST = "fairground-kor.com";
const LEGACY_HOSTS = [
  "www.fairground-kor.com",
  "fairground-futsal.vercel.app",
  "fairground-footsal.vercel.app",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web", "onnxruntime-node"],
  images: {
    remotePatterns: [
      // Team logos / uploaded assets — Supabase Storage
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      // Country flags
      { protocol: "https", hostname: "flagcdn.com", pathname: "/**" },
    ],
  },
  async redirects() {
    return LEGACY_HOSTS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${CANONICAL_HOST}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // frame-ancestors 'self' — X-Frame-Options 의 현대식 보강(임베딩만 제한,
          // 다른 리소스는 미제한이라 앱 동작 영향 없음). 타 사이트의 iframe 도용 차단.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
