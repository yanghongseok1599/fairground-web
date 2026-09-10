import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const destination = new URL("../public/vendor/mediapipe/0.10.32/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  await copyFile(join(packageRoot, "wasm", file), new URL(file, destination));
}
