"use client";

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PlayerCardCaptureFrame } from "@/components/player-card-capture-frame";
import { elementToPngBlob } from "@/lib/card-download";
import { PLAYER_CARD_COMPOSITION } from "@/lib/player-card-frame";
import type { CardExportJob } from "./model";

/** Sequential use keeps memory bounded. A failed image never becomes a blank successful card. */
export async function renderBronzePlayerCard(job: CardExportJob): Promise<Blob> {
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "absolute", left: "-10000px", top: "0",
    width: `${PLAYER_CARD_COMPOSITION.width}px`, pointerEvents: "none",
  });
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(
      <PlayerCardCaptureFrame player={job.player} teamLogo={job.teamLogo}
        appearance="bronze" displayWidth={PLAYER_CARD_COMPOSITION.width} />,
    ));
    const deadline = Date.now() + 25000;
    while (host.querySelector('[data-player-card-assets-ready="false"]')) {
      if (Date.now() > deadline) throw new Error("팀 로고 준비 시간이 초과되었습니다.");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const imagesReady = Promise.all(Array.from(host.querySelectorAll("img"), async (image) => {
      await image.decode();
      if (!image.naturalWidth) throw new Error("선수카드 이미지가 비어 있습니다.");
    }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        imagesReady,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("선수 사진 준비 시간이 초과되었습니다.")), 25000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    return await elementToPngBlob(host);
  } finally {
    root.unmount();
    host.remove();
  }
}
