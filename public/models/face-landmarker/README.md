# Player-card face landmarks

- Model: Google MediaPipe Face Landmarker, float16, version 1.
- Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- Runtime: `@mediapipe/tasks-vision@0.10.32` (Apache-2.0). Its matching WASM files are copied by `scripts/prepare-face-landmarker.mjs` on install.

The model and runtime are served from this application. Uploaded photos are processed locally in the browser and are not sent to a face-recognition service. No face embeddings or identity database are created.
