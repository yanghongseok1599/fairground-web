import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { requireSingleFace } from "./face-geometry";

let detectorPromise: Promise<FaceLandmarker> | undefined;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/vendor/mediapipe/0.10.32");
      const response = await fetch("/models/face-landmarker/face_landmarker.task", { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("얼굴 인식 모델을 불러오지 못했습니다. 다시 시도해주세요.");
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: new Uint8Array(await response.arrayBuffer()), delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
      });
    })().catch((error) => {
      detectorPromise = undefined;
      throw error;
    });
  }
  return detectorPromise;
}

export async function detectCardFace(image: HTMLImageElement) {
  const detector = await getFaceLandmarker();
  // Same model on Safari and Chromium; never guess a crop when detection fails.
  return requireSingleFace(detector.detect(image).faceLandmarks);
}
