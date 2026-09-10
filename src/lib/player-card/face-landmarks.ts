import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { requireSingleFace } from "./face-geometry";
import { loadVisionModel } from "./vision-model";

let detectorPromise: Promise<FaceLandmarker> | undefined;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks("/vendor/mediapipe/0.10.32");
      const model = await loadVisionModel("/models/face-landmarker/face_landmarker.task");
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: model, delegate: "CPU" },
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
