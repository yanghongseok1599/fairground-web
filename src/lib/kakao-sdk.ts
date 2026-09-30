"use client";

const KAKAO_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const KAKAO_SDK_INTEGRITY =
  "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
const KAKAO_SDK_SCRIPT_ID = "fairground-kakao-sdk";

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

export function isKakaoShareConfigured(): boolean {
  return getKakaoJavascriptKey().length > 0;
}

function initializeKakaoSdk(sdk: KakaoSdk): KakaoSdk {
  const key = getKakaoJavascriptKey();
  if (!key) throw new Error("카카오 JavaScript 키가 설정되지 않았습니다.");
  if (!sdk.isInitialized()) sdk.init(key);
  return sdk;
}

export function loadKakaoSdk(): Promise<KakaoSdk> {
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

    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("카카오 공유 연결 시간이 초과되었습니다."));
    }, 15000);

    const finish = () => {
      window.clearTimeout(timeout);
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
      () => {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error("카카오 공유 SDK를 불러오지 못했습니다."));
      },
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
