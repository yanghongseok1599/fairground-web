import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyCommand, createEvent } from "../engine.ts";
import type { Command, EventState } from "../types.ts";

interface StoredEvent {
  state: EventState;
  tokenHash: string;
  requests: string[];
}

export class EventStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function localEventEnabled() {
  return process.env.FAIRGROUND_EVENT_LOCAL === "1" && !process.env.VERCEL;
}
export function requireLocalEvent() {
  if (!localEventEnabled())
    throw new EventStoreError(
      "현장 운영 서버를 실행해 주세요. 프로젝트에서 npm run dev:event 명령으로 시작할 수 있습니다.",
      503,
    );
}

function directory() {
  return (
    process.env.FAIRGROUND_EVENT_DATA_DIR ||
    path.join(process.cwd(), ".local", "alliance-events")
  );
}
function eventPath(id: string) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      id,
    )
  )
    throw new EventStoreError("이벤트 주소가 올바르지 않습니다.", 404);
  return path.join(directory(), `${id}.json`);
}
const hash = (value: string) => createHash("sha256").update(value).digest();
function authorize(stored: StoredEvent, token: string) {
  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    !timingSafeEqual(hash(token), Buffer.from(stored.tokenHash, "hex"))
  )
    throw new EventStoreError(
      "운영 권한이 없습니다. 이벤트를 만든 브라우저 또는 운영 전용 링크로 접속해 주세요.",
      403,
    );
}

async function readStored(id: string): Promise<StoredEvent> {
  try {
    return JSON.parse(await readFile(eventPath(id), "utf8")) as StoredEvent;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new EventStoreError(
        "이벤트를 찾을 수 없습니다. 실행한 노트북과 이벤트 주소를 확인해 주세요.",
        404,
      );
    throw error;
  }
}

async function atomicSave(id: string, stored: StoredEvent) {
  const file = eventPath(id);
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(stored), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Filesystem lock + revision check also serialize requests from separate Next workers. */
async function withLock<T>(id: string, callback: () => Promise<T>): Promise<T> {
  const lock = `${eventPath(id)}.lock`;
  const deadline = Date.now() + 3000;
  while (true) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Recover a lock left by a terminated local process, never a normal in-flight write.
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 60000) {
        await rm(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline)
        throw new EventStoreError(
          "다른 저장이 진행 중입니다. 잠시 후 다시 시도해 주세요.",
          409,
        );
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
  try {
    return await callback();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

export async function newLocalEvent(demo: boolean) {
  requireLocalEvent();
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  const state = createEvent(id, demo, Date.now());
  await atomicSave(id, {
    state,
    tokenHash: hash(token).toString("hex"),
    requests: [],
  });
  return { id, token, state };
}

export async function readLocalEvent(id: string, token?: string) {
  requireLocalEvent();
  const stored = await readStored(id);
  if (token !== undefined) {
    authorize(stored, token);
    return {
      state: stored.state,
      requestIds: stored.requests,
      serverTime: Date.now(),
    };
  }
  return {
    id,
    version: stored.state.version,
    output: stored.state.output,
    serverTime: Date.now(),
  };
}

export async function writeLocalEvent(
  id: string,
  token: string,
  expectedVersion: number,
  requestId: string,
  command: Command,
) {
  requireLocalEvent();
  if (
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0 ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)
  )
    throw new EventStoreError("저장 요청이 올바르지 않습니다.");
  return withLock(id, async () => {
    const stored = await readStored(id);
    authorize(stored, token);
    // Reusing an uncertain request is safe even when the first response was lost.
    if (stored.requests.includes(requestId))
      return { state: stored.state, serverTime: Date.now() };
    if (stored.state.version !== expectedVersion)
      throw new EventStoreError(
        "다른 운영 화면에서 기록이 변경되었습니다. 최신 기록을 확인하고 다시 눌러 주세요.",
        409,
      );
    try {
      stored.state = applyCommand(
        stored.state,
        command,
        Date.now(),
        randomUUID,
      );
    } catch (error) {
      throw new EventStoreError(
        error instanceof Error ? error.message : "입력값을 확인해 주세요.",
      );
    }
    stored.requests = [...stored.requests, requestId].slice(-200);
    if (Buffer.byteLength(JSON.stringify(stored)) > 2_000_000)
      throw new EventStoreError(
        "이벤트 기록 한도에 도달했습니다. 기록을 백업하고 새 이벤트를 만들어 주세요.",
      );
    await atomicSave(id, stored);
    return { state: stored.state, serverTime: Date.now() };
  });
}
