import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest — Next.js 16 Metadata Route (App Router).
 * 색상은 브랜드키트 토큰을 manifest 스펙상 리터럴로 미러링:
 *   theme_color  = Primary Blue  #0047AB  (globals.css --color-fg-blue)
 *   background_color = Paper      #FFFFFF  (globals.css --color-fg-paper)
 *   (manifest.json 은 CSS 변수를 해석하지 못하므로 동일 값을 명시. 토큰 변경 시 동기화 필요.)
 *
 * layout.tsx 의 metadata.icons / viewport.themeColor 와는 역할이 분리됨:
 *   - layout: 브라우저 탭/탐색 favicon, 모바일 status bar theme
 *   - manifest: 홈 화면 설치(installable) 시 아이콘/스플래시/색상
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FairGround — Where Amateurs Play Pro",
    short_name: "FairGround",
    description:
      "서울 아마추어 풋살 리그. 실시간 스코어·개인 스탯·선수 카드. 경기장 밖에서도 프로처럼.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0047AB",
    background_color: "#FFFFFF",
    lang: "ko",
    categories: ["sports"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
