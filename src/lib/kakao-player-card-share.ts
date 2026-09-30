"use client";

import { compressImageBlob } from "@/lib/image-compression";
import { getPlayerCardShareUrls } from "@/lib/player-card-share-links";

import { loadKakaoSdk, isKakaoShareConfigured } from "@/lib/kakao-sdk";

const KAKAO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const isKakaoPlayerCardShareConfigured = isKakaoShareConfigured;

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
