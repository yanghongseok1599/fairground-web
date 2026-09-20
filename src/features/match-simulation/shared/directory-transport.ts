import { supabase } from "@/config/supabase";
import { listActiveRooms, type ListedRoom, type RoomAdvertisement } from "./directory";

export interface DirectoryState {
  connected: boolean;
  rooms: ListedRoom[];
  error: string;
}

/** Only active practice room IDs and role counts are advertised, never member profiles or records. */
export function connectRoomDirectory(onChange: (state: DirectoryState) => void, member?: RoomAdvertisement) {
  const channel = supabase.channel("practice-directory-v1", {
    config: { presence: { key: member?.id ?? crypto.randomUUID() } },
  });
  let closed = false;
  let connected = false;
  const failed = () => {
    if (closed) return;
    connected = false;
    onChange({ connected: false, rooms: [], error: "공유 경기 목록에 연결하지 못했습니다. 연결을 다시 시도해주세요." });
  };
  const sync = () => {
    if (closed || !connected) return;
    onChange({ connected: true, rooms: listActiveRooms(Object.values(channel.presenceState()).flat()), error: "" });
  };
  window.addEventListener("offline", failed);
  channel.on("presence", { event: "sync" }, sync).subscribe(async (state) => {
    if (closed) return;
    if (state === "SUBSCRIBED") {
      connected = true;
      if (member && await channel.track(member) !== "ok") { failed(); return; }
      sync();
    } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) failed();
  });
  return () => {
    if (closed) return;
    closed = true;
    window.removeEventListener("offline", failed);
    void supabase.removeChannel(channel);
  };
}
