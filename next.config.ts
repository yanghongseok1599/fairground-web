import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web", "onnxruntime-node"],
  images: {
    remotePatterns: [
      // Team logos / uploaded assets — Supabase Storage
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      // Country flags
      { protocol: "https", hostname: "flagcdn.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
