import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

loadLocalEnv(path.resolve(".env.local"));

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing.");

const model = process.env.OPENROUTER_VIDEO_MODEL ?? "bytedance/seedance-2.0-fast";
const siteUrl = process.env.HERO_SITE_URL ?? "https://fairground-footsal.vercel.app";
const baseUrl = `${siteUrl}/images/reveal-sequence-4k`;
const outDir = path.resolve("public/videos/hero-seedance-all-images");
const finalVideo = path.resolve("public/videos/fairground-mobile-hero.mp4");

const transitions = [
  ["01", "02", "Smooth cinematic forward move through the same dark futuristic sports tunnel. Neon green strip lights rush past on ceiling and floor, dark navy walls, wet reflective floor, cinematic fog, stable symmetrical composition, no text, no warping."],
  ["02", "03", "Continue the forward tunnel motion into a blinding white exit. Neon green lines converge into the intense white light, smooth speed ramp, cinematic bloom, stable tunnel geometry, no text, no sudden shake."],
  ["03", "04", "The white tunnel exit light naturally resolves into an indoor futsal stadium at night. A dramatic award stage appears at center field with a blank white premium player card upright on a pedestal. Smooth forward camera motion, gold and green lighting."],
  ["04", "05", "Same indoor futsal stadium and same centered card on pedestal. The card flashes with bright gold and white energy, electric sparks and particles radiate from the card surface, controlled cinematic pulse, keep the card centered and upright."],
  ["05", "06", "Same composition. The flashing card stabilizes and reveals the South Korean flag inside the card face. Keep card shape fixed, stadium lights and gold green ambience moving subtly, no logo changes, no extra text."],
  ["06", "07", "Same composition. Transition from the South Korean flag hint to the exact black and gold AFC team logo hint shown in the target frame. Keep the card centered, preserve the logo shape, gold and green particles, no invented badge, no REF text."],
  ["07", "08", "Same composition. Transition from the AFC team logo hint to bold gold chrome text FIXO inside the card face. Keep card shape fixed and upright, keep background stadium lights active, avoid text distortion."],
  ["08", "09", "Grand final reveal into the exact FairGround premium player card shown in the final target frame. Preserve rating 104, position FIXO, player portrait, black and gold AFC logo, Korean flag, name 김도현, and lower stats. Gold confetti, green particles, slow push-in, readable final card."],
];

function frameUrl(index) {
  return `${baseUrl}/fairground-reveal-${index}.png`;
}

async function submitTransition([from, to, prompt], index) {
  const body = {
    model,
    prompt,
    duration: 4,
    resolution: "720p",
    aspect_ratio: "9:16",
    generate_audio: false,
    frame_images: [
      {
        type: "image_url",
        image_url: { url: frameUrl(from) },
        frame_type: "first_frame",
      },
      {
        type: "image_url",
        image_url: { url: frameUrl(to) },
        frame_type: "last_frame",
      },
    ],
  };

  const response = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": "FairGround Mobile Hero All Images",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`submit ${index} failed: ${await response.text()}`);
  }

  return response.json();
}

async function pollJob(job, index) {
  let current = job;
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    if (current.status === "completed") return current;
    if (["failed", "cancelled", "expired"].includes(current.status)) {
      throw new Error(`job ${index} ${current.status}: ${current.error ?? "no error detail"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 30_000));

    const pollUrl = new URL(current.polling_url, "https://openrouter.ai");
    const response = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`poll ${index} failed: ${await response.text()}`);
    }

    current = await response.json();
    console.log(`clip ${index}: ${current.status}`);
  }

  throw new Error(`job ${index} timed out`);
}

async function downloadJob(job, index) {
  const videoUrl =
    job.unsigned_urls?.[0] ??
    `https://openrouter.ai/api/v1/videos/${job.id}/content?index=0`;

  const response = await fetch(videoUrl, {
    headers: videoUrl.startsWith("https://openrouter.ai/api/")
      ? { Authorization: `Bearer ${apiKey}` }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`download ${index} failed: ${await response.text()}`);
  }

  const clipPath = path.join(outDir, `clip-${String(index).padStart(2, "0")}.mp4`);
  await writeFile(clipPath, Buffer.from(await response.arrayBuffer()));
  return clipPath;
}

async function concatClips(clipPaths) {
  const inputs = clipPaths.flatMap((clip) => ["-i", clip]);
  const setpts = clipPaths.map((_, i) => `[${i}:v]setpts=0.75*(PTS-STARTPTS)[v${i}]`).join(";");
  const concatInputs = clipPaths.map((_, i) => `[v${i}]`).join("");

  await execFileAsync("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    `${setpts};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[outv]`,
    "-map",
    "[outv]",
    "-r",
    "24",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    finalVideo,
  ]);
}

await mkdir(outDir, { recursive: true });
await mkdir(path.dirname(finalVideo), { recursive: true });

const clipPaths = [];
for (const [i, transition] of transitions.entries()) {
  const index = i + 1;
  console.log(`submitting clip ${index}: ${transition[0]} -> ${transition[1]}`);
  const job = await submitTransition(transition, index);
  console.log(`clip ${index}: ${job.status} (${job.id})`);
  const completed = await pollJob(job, index);
  const clipPath = await downloadJob(completed, index);
  console.log(`clip ${index}: saved ${clipPath}`);
  clipPaths.push(clipPath);
}

await concatClips(clipPaths);

const stat = await readFile(finalVideo);
console.log(`final: ${finalVideo}`);
console.log(`bytes: ${stat.byteLength}`);
