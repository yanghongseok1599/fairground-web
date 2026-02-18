import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@imgly/background-removal", "onnxruntime-web", "onnxruntime-node"],
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
