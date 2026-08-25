import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv(path.resolve(".env.local"));

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is missing.");
}

const model = process.env.OPENROUTER_VIDEO_MODEL ?? "bytedance/seedance-2.0-fast";
const siteUrl = process.env.HERO_SITE_URL ?? "https://fairground-futsal.vercel.app";
const frameBaseUrl = `${siteUrl}/images/reveal-sequence-4k`;
const anchorBaseUrl = `${siteUrl}/images/seedance-chain`;
const outDir = path.resolve("public/videos/hero-seedance-chain");
const anchorDir = path.resolve("public/images/seedance-chain");
const finalVideo = path.resolve("public/videos/fairground-mobile-hero.mp4");

const cuts = [
  {
    name: "tunnel-entry",
    firstUrl: `${frameBaseUrl}/fairground-reveal-01.png`,
    lastUrl: `${frameBaseUrl}/fairground-reveal-03.png`,
    prompt:
      "Smooth cinematic forward dolly through the same dark futuristic sports tunnel. Neon green strip lights converge toward a bright white tunnel exit. Keep architecture stable and symmetrical, no warping, no flicker, no sudden composition change. Only forward camera motion, fog, light bloom, and subtle speed ramp. Vertical 9:16 mobile hero video.",
  },
  {
    name: "stadium-card",
    lastUrl: `${frameBaseUrl}/fairground-reveal-05.png`,
    prompt:
      "Transition naturally from the blinding white tunnel exit into an indoor futsal stadium award stage. The white light resolves into a glowing blank premium player card on a pedestal at center field. Keep camera moving forward smoothly, no sudden jump, no morphing shapes, stable centered composition, gold and green cinematic lighting, sparks and particles. Vertical 9:16.",
  },
  {
    name: "card-hints",
    lastUrl: `${frameBaseUrl}/fairground-reveal-08.png`,
    prompt:
      'Same indoor futsal stadium, same stage, same centered card on pedestal. The card face reveals controlled hint moments through clean light pulses: South Korean flag, REF AFC logo, then bold FIXO text. Keep card shape fixed and upright, avoid text distortion, avoid logo distortion, only glow, particles, and spotlight movement. Smooth camera push-in. Vertical 9:16.',
  },
  {
    name: "final-reveal",
    lastUrl: `${frameBaseUrl}/fairground-reveal-09.png`,
    prompt:
      "The card transforms into the exact FairGround premium player card shown in the final reference. Preserve the card layout, player portrait, rating 104, position FIXO, REF AFC logo, Korean flag, name 김도현, and lower stats. Gold confetti explosion and green particles fill the stadium. Keep the final card sharp and readable. Slow push-in, then hold. No warping, no changing text or logos. Vertical 9:16.",
  },
];

async function submitCut(cut, index, firstUrl) {
  const body = {
    model,
    prompt: cut.prompt,
    duration: 4,
    resolution: "720p",
    aspect_ratio: "9:16",
    generate_audio: false,
    frame_images: [
      {
        type: "image_url",
        image_url: { url: firstUrl },
        frame_type: "first_frame",
      },
      {
        type: "image_url",
        image_url: { url: cut.lastUrl },
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
      "X-Title": "FairGround Mobile Hero Chained",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`submit cut ${index} failed: ${await response.text()}`);
  }

  return response.json();
}

async function pollJob(job, index) {
  let current = job;
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    if (current.status === "completed") return current;
    if (["failed", "cancelled", "expired"].includes(current.status)) {
      throw new Error(`cut ${index} ${current.status}: ${current.error ?? "no error detail"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 30_000));

    if (!current.polling_url) {
      throw new Error(`cut ${index} missing polling_url`);
    }

    const pollUrl = new URL(current.polling_url, "https://openrouter.ai");
    const response = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`poll cut ${index} failed: ${await response.text()}`);
    }

    current = await response.json();
    console.log(`cut ${index}: ${current.status}`);
  }

  throw new Error(`cut ${index} timed out`);
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
    throw new Error(`download cut ${index} failed: ${await response.text()}`);
  }

  const clipPath = path.join(outDir, `chain-cut-${String(index).padStart(2, "0")}.mp4`);
  await writeFile(clipPath, Buffer.from(await response.arrayBuffer()));
  return clipPath;
}

async function extractLastFrame(clipPath, index) {
  const anchorPath = path.join(anchorDir, `anchor-${String(index).padStart(2, "0")}.jpg`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-sseof",
    "-0.08",
    "-i",
    clipPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    anchorPath,
  ]);
  return anchorPath;
}

async function deployPublicAssets(label) {
  console.log(`deploying ${label} to ${siteUrl}`);
  const { stdout, stderr } = await execFileAsync("vercel", ["deploy", "--prod", "--yes"], {
    maxBuffer: 1024 * 1024 * 20,
  });
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}

async function makeFinalHold() {
  const holdPath = path.join(outDir, "final-card-hold.mp4");
  await execFileAsync("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-t",
    "3",
    "-i",
    path.resolve("public/images/reveal-sequence-4k/fairground-reveal-09.png"),
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
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
    holdPath,
  ]);
  return holdPath;
}

async function concatFinal(clipPaths) {
  const inputs = clipPaths.flatMap((clip) => ["-i", clip]);
  const setpts = clipPaths
    .map((_, i) => `[${i}:v]setpts=PTS-STARTPTS[v${i}]`)
    .join(";");
  const concatInputs = clipPaths.map((_, i) => `[v${i}]`).join("");
  const filter = `${setpts};${concatInputs}concat=n=${clipPaths.length}:v=1:a=0[outv]`;

  await execFileAsync("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    filter,
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
await mkdir(anchorDir, { recursive: true });
await mkdir(path.dirname(finalVideo), { recursive: true });

let firstUrl = cuts[0].firstUrl;
const clipPaths = [];
for (const [i, cut] of cuts.entries()) {
  const index = i + 1;
  console.log(`submitting cut ${index}: ${cut.name}`);
  console.log(`first: ${firstUrl}`);
  console.log(`last:  ${cut.lastUrl}`);
  const job = await submitCut(cut, index, firstUrl);
  console.log(`cut ${index}: ${job.status} (${job.id})`);
  const completed = await pollJob(job, index);
  const clipPath = await downloadJob(completed, index);
  console.log(`cut ${index}: saved ${clipPath}`);
  clipPaths.push(clipPath);

  if (index < cuts.length) {
    const anchorPath = await extractLastFrame(clipPath, index);
    console.log(`cut ${index}: anchor ${anchorPath}`);
    await deployPublicAssets(`anchor ${index}`);
    firstUrl = `${anchorBaseUrl}/anchor-${String(index).padStart(2, "0")}.jpg`;
  }
}

const finalHold = await makeFinalHold();
await concatFinal([...clipPaths, finalHold]);
await deployPublicAssets("final chained video");

const stat = await readFile(finalVideo);
console.log(`final: ${finalVideo}`);
console.log(`bytes: ${stat.byteLength}`);
