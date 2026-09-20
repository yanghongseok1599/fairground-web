import { supabase } from "@/config/supabase";
import type { RoomMember, RoomMessage } from "./protocol";
import type { RoomTransport } from "./session";

export function realtimeRoomTransport(room: string, member: RoomMember): RoomTransport {
  const channel = supabase.channel(`practice-room-v1:${room}`, {
    config: { broadcast: { self: false, ack: true }, presence: { key: member.id } },
  });
  let closed = false;
  let offline: (() => void) | undefined;
  return {
    connect(handlers) {
      offline = () => handlers.connection(false);
      window.addEventListener("offline", offline);
      channel.on("broadcast", { event: "practice" }, ({ payload }) => handlers.message(payload as RoomMessage))
        .on("presence", { event: "sync" }, () => handlers.members(Object.values(channel.presenceState<RoomMember>()).flat()))
        .subscribe(async state => {
          if (closed) return;
          if (state === "SUBSCRIBED") {
            handlers.connection(true);
            if (await channel.track(member) !== "ok") handlers.connection(false);
          } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) handlers.connection(false);
        });
    },
    async send(message) {
      if (closed || channel.state !== "joined" || !navigator.onLine) throw new Error("Realtime disconnected");
      if (await channel.send({ type: "broadcast", event: "practice", payload: message }) !== "ok") throw new Error("Broadcast was not acknowledged");
    },
    close() {
      closed = true;
      if (offline) window.removeEventListener("offline", offline);
      void supabase.removeChannel(channel);
    },
  };
}
