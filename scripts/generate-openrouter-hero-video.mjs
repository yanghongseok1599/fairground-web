import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is missing.");
}

const model = process.env.OPENROUTER_VIDEO_MODEL ?? "bytedance/seedance-2.0-fast";
const baseUrl =
  process.env.HERO_FRAME_BASE_URL ??
  "https://fairground-footsal.vercel.app/images/reveal-sequence-4k";
const outDir = path.resolve("public/videos/hero-seedance");
const finalVideo = path.resolve("public/videos/fairground-mobile-hero.mp4");

const transitions = [
  {
    from: "01",
    to: "02",
    prompt:
      "First-person camera begins moving forward through the same dark futuristic sports tunnel. Neon green strips streak gently past, wet floor reflections glide forward, cinematic fog, no text.",
  },
  {
    from: "02",
    to: "03",
    prompt:
      "Accelerate toward the end of the sports tunnel. Green neon lines converge into an overwhelming white light bloom at the exit, smooth cinematic forward motion, no text.",
  },
  {
    from: "03",
    to: "04",
    prompt:
      "Pass through the blinding white tunnel exit into an indoor futsal stadium reveal. The glow resolves into a centered award stage with a blank premier card on a pedestal, gold and green lighting.",
  },
  {
    from: "04",
    to: "05",
    prompt:
      "Hold the same stadium and pedestal composition while the blank premier card starts flashing with gold-white energy. Sparks and particles pulse from the card surface.",
  },
  {
    from: "05",
    to: "06",
    prompt:
      "The flashing card stabilizes and reveals the South Korean flag inside the same card face. Keep the card upright on the pedestal, gold and green spotlight, crowd silhouettes.",
  },
  {
    from: "06",
    to: "07",
    prompt:
      "The card hint transitions from the South Korean flag to the AFC team logo. Keep the exact same stadium stage, centered card, premium gold and emerald frame lighting.",
  },
  {
    from: "07",
    to: "08",
    prompt:
      "The AFC logo hint transitions into the bold FIXO position hint on the same card. Preserve the centered card, pedestal, stadium lights, green and gold particles.",
  },
  {
    from: "08",
    to: "09",
    prompt:
      "Final grand reveal: the FIXO hint transforms into the real FairGround premier player card. Preserve the ornate emerald frame, AFC logo, 104 rating, player portrait, Korean text and stats, with gold confetti climax.",
  },
];

function frameUrl(index) {
  return `${baseUrl}/fairground-reveal-${index}.png`;
}

async function submitTransition(transition, index) {
  const body = {
    model,
    prompt: transition.prompt,
    duration: 4,
    resolution: "720p",
    aspect_ratio: "9:16",
    generate_audio: false,
    frame_images: [
      {
        type: "image_url",
        image_url: { url: frameUrl(transition.from) },
        frame_type: "first_frame",
      },
      {
        type: "image_url",
        image_url: { url: frameUrl(transition.to) },
        frame_type: "last_frame",
      },
    ],
  };

  const response = await fetch("https://openrouter.ai/api/v1/videos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fairground-footsal.vercel.app",
      "X-Title": "FairGround Mobile Hero",
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

    if (!current.polling_url) {
      throw new Error(`job ${index} missing polling_url`);
    }

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
  const listPath = path.join(outDir, "clips.txt");
  const list = clipPaths.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n");
  await writeFile(listPath, `${list}\n`);

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    finalVideo,
  ]);
}

await mkdir(outDir, { recursive: true });
await mkdir(path.dirname(finalVideo), { recursive: true });

const clipPaths = [];
for (const [i, transition] of transitions.entries()) {
  const index = i + 1;
  console.log(`submitting clip ${index}: ${transition.from} -> ${transition.to}`);
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
