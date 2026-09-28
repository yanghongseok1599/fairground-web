import type { RecordingInput } from "./types";

type StoragePort = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
type Pending = RecordingInput & { requestId: string };
/** One key per request avoids two tabs overwriting each other's queue. Server receipts deduplicate retries. */
export function createRecordingOutbox(storage: StoragePort, accountId: string, matchId: string) {
  const prefix = `fg-recording-v1:${accountId}:${matchId}:`;
  const list = (): Pending[] => {
    const entries: Pending[] = [];
    for (let i=0; i<storage.length; i++) {
      const key=storage.key(i); if (!key?.startsWith(prefix)) continue;
      const entry=JSON.parse(storage.getItem(key) ?? "null") as Pending | null;
      if (!entry?.requestId || key !== prefix+entry.requestId || !entry.playerId || entry.actorId !== accountId || !Number.isInteger(entry.minute) || ![1,2].includes(entry.half) || !["goal","assist","foul","yellow_card","red_card"].includes(entry.type)) {
        throw new Error("보관 중인 기록을 읽지 못했습니다. 저장 데이터를 지우지 말고 관리자에게 확인해주세요.");
      }
      entries.push(entry);
    }
    return entries;
  };
  return {
    list,
    stage(input: RecordingInput): Pending {
      const entry={...input, requestId:crypto.randomUUID(), actorId:accountId};
      const value=JSON.stringify(entry), key=prefix+entry.requestId;
      storage.setItem(key,value);
      if(storage.getItem(key)!==value) throw new Error("이 기기에 기록을 보관하지 못했습니다. 저장 공간을 확인해주세요.");
      return entry;
    },
    async send(entry: Pending, save: (input: Pending)=>Promise<void>) {
      await save(entry);
      // Keep the receipt pending if removing the local copy fails; replay is safe.
      storage.removeItem(prefix+entry.requestId);
    },
  };
}
