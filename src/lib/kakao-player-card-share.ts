"use client";

import { compressImageBlob } from "@/lib/image-compression";
import { getPlayerCardShareUrls } from "@/lib/player-card-share-links";

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
const KAKAO_SDK_SCRIPT_ID = "fairground-kakao-sdk";
const KAKAO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type KakaoImageInfo = {
  url: string;
  width?: number;
  height?: number;
};

type KakaoSdk = {
  init(key: string): void;
  isInitialized(): boolean;
  Share: {
    uploadImage(options: { file: FileList }): Promise<{
      infos: { original: KakaoImageInfo };
    }>;
    sendDefault(options: {
      objectType: "feed";
      content: {
        title: string;
        description: string;
        imageUrl: string;
        imageWidth?: number;
        imageHeight?: number;
        link: { mobileWebUrl: string; webUrl: string };
      };
      buttons: Array<{
        title: string;
        link: { mobileWebUrl: string; webUrl: string };
      }>;
    }): void | Promise<unknown>;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let kakaoSdkPromise: Promise<KakaoSdk> | null = null;

function getKakaoJavascriptKey(): string {
  return process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
}

export function isKakaoPlayerCardShareConfigured(): boolean {
  return getKakaoJavascriptKey().length > 0;
}

function initializeKakaoSdk(sdk: KakaoSdk): KakaoSdk {
  const key = getKakaoJavascriptKey();
  if (!key) throw new Error("카카오 JavaScript 키가 설정되지 않았습니다.");
  if (!sdk.isInitialized()) sdk.init(key);
  return sdk;
}

function loadKakaoSdk(): Promise<KakaoSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("카카오 공유는 브라우저에서만 사용할 수 있습니다."));
  }
  if (window.Kakao) return Promise.resolve(initializeKakaoSdk(window.Kakao));
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise<KakaoSdk>((resolve, reject) => {
    const existingScript = document.getElementById(
      KAKAO_SDK_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script: HTMLScriptElement =
      existingScript ?? document.createElement("script");

    const finish = () => {
      if (!window.Kakao) {
        reject(new Error("카카오 공유 SDK를 불러오지 못했습니다."));
        return;
      }
      try {
        resolve(initializeKakaoSdk(window.Kakao));
      } catch (error) {
        reject(error);
      }
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("카카오 공유 SDK를 불러오지 못했습니다.")),
      { once: true },
    );

    if (!existingScript) {
      script.id = KAKAO_SDK_SCRIPT_ID;
      script.src = KAKAO_SDK_URL;
      script.integrity = KAKAO_SDK_INTEGRITY;
      script.crossOrigin = "anonymous";
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    kakaoSdkPromise = null;
    throw error;
  });

  return kakaoSdkPromise;
}

async function prepareKakaoCardImage(blob: Blob): Promise<Blob> {
  let image = await compressImageBlob(blob, {
    maxPx: 1600,
    mimeType: "image/jpeg",
    quality: 0.9,
  });

  if (image.size > KAKAO_IMAGE_MAX_BYTES) {
    image = await compressImageBlob(blob, {
      maxPx: 1280,
      mimeType: "image/jpeg",
      quality: 0.82,
    });
  }

  if (image.size > KAKAO_IMAGE_MAX_BYTES) {
    throw new Error("카카오 공유 이미지의 용량을 5MB 이하로 줄이지 못했습니다.");
  }
  return image;
}

function createFileList(file: File): FileList {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  return transfer.files;
}

type KakaoPlayerCardShareInput = {
  cardBlob: Blob;
  origin: string;
  playerId: string;
  playerName: string;
};

/** Returns false when Kakao is not configured so callers can use native share. */
export async function sharePlayerCardWithKakao({
  cardBlob,
  origin,
  playerId,
  playerName,
}: KakaoPlayerCardShareInput): Promise<boolean> {
  if (!isKakaoPlayerCardShareConfigured()) return false;

  const [sdk, imageBlob] = await Promise.all([
    loadKakaoSdk(),
    prepareKakaoCardImage(cardBlob),
  ]);
  const file = new File([imageBlob], `${playerName}-fairground.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
  const upload = await sdk.Share.uploadImage({ file: createFileList(file) });
  const image = upload.infos.original;
  if (!image?.url) throw new Error("카카오 공유 이미지 주소를 받지 못했습니다.");

  const { playerUrl, createCardUrl } = getPlayerCardShareUrls(origin, playerId);
  const playerLink = { mobileWebUrl: playerUrl, webUrl: playerUrl };
  const createCardLink = { mobileWebUrl: createCardUrl, webUrl: createCardUrl };

  await Promise.resolve(
    sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title: `${playerName}님의 FairGround 선수 카드`,
        description: "선수 카드를 확인하고 나만의 FairGround 카드를 만들어보세요.",
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
        link: playerLink,
      },
      buttons: [
        { title: "선수 카드 보기", link: playerLink },
        { title: "선수카드 만들러 가기", link: createCardLink },
      ],
    }),
  );
  return true;
}
