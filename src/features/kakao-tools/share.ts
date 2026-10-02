"use client";

import { isKakaoShareConfigured, loadKakaoSdk } from "@/lib/kakao-sdk";

export type EventShareContent = { title: string; description: string; url: string; imageUrl?: string };

export async function shareEvent(content: EventShareContent): Promise<string> {
  if (isKakaoShareConfigured()) {
    // Do not automatically open a second share dialog if Kakao fails.
    const sdk = await loadKakaoSdk();
    const link = { webUrl: content.url, mobileWebUrl: content.url };
    await Promise.resolve(sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title: content.title.slice(0, 200),
        description: content.description.slice(0, 200),
        imageUrl: content.imageUrl ?? new URL("/og-image-futsal-shoes-v2.png", content.url).href,
        imageWidth: 1200,
        imageHeight: 630,
        link,
      },
      buttons: [{ title: "대회·경기 보기", link }],
    }));
    return "카카오톡에서 공유할 대화방을 선택해주세요.";
  }
  if (navigator.share) {
    await navigator.share({ title: content.title, text: content.description, url: content.url });
    return "공유를 완료했습니다.";
  }
  await navigator.clipboard.writeText(`${content.title}\n${content.description}\n${content.url}`);
  return "공유할 내용과 링크를 복사했습니다.";
}
