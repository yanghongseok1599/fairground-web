"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Copy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulationWorkspace } from "../simulation-workspace";
import { PracticeAdminView } from "./admin-view";
import { readRoomFrame, roomLink, roomStorageKey, type RoomRole } from "./protocol";
import { createRoomSession } from "./session";
import { realtimeRoomTransport } from "./transport";

export function SharedRoomPage({ room, role }: { room: string; role?: RoomRole }) {
  if (!role) return <section className="mx-auto max-w-2xl space-y-5 px-4 py-10">
    <h1 className="text-2xl font-black">함께 테스트 경기</h1>
    <p>각자 역할을 선택하면 같은 경기로 연결됩니다.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={() => location.assign(roomLink(location.origin, room, "referee"))}>심판으로 입장</Button><Button variant="outline" onClick={() => location.assign(roomLink(location.origin, room, "admin"))}>관리자로 입장</Button></div>
    <p className="text-sm text-muted-foreground">가상 선수로 진행하는 연습 역할입니다. 실제 계정 권한이나 선수 기록은 바뀌지 않습니다.</p>
  </section>;
  return <ConnectedRoom key={`${room}:${role}`} room={room} role={role} />;
}

function ConnectedRoom({ room, role }: { room: string; role: RoomRole }) {
  const [identity] = useState(() => ({ id: crypto.randomUUID(), role, joinedAt: Date.now() }));
  const [session] = useState(() => {
    let saved;
    try { saved = readRoomFrame(JSON.parse(sessionStorage.getItem(roomStorageKey(room)) ?? "null"), room); } catch { /* Start without a saved snapshot. */ }
    return createRoomSession({ room, role, id: identity.id, saved,
      transport: () => realtimeRoomTransport(room, identity),
      save: frame => sessionStorage.setItem(roomStorageKey(room), JSON.stringify(frame)),
    });
  });
  const state = useStore(session.status);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    session.start();
    const timer = window.setInterval(() => session.pulse(), 1000);
    return () => { clearInterval(timer); session.stop(); };
  }, [session]);
  const activeSeat = role === "referee" ? state.referee : state.admin;
  const duplicate = activeSeat !== null && activeSeat !== identity.id;
  const active = state.connected && state.ready && !duplicate;
  const copy = async (target: RoomRole) => {
    try { await navigator.clipboard.writeText(roomLink(location.origin, room, target)); setCopied(`${target === "referee" ? "심판" : "관리자"} 링크를 복사했습니다.`); }
    catch { setCopied("아래 링크를 길게 누르거나 주소를 복사해 전달해주세요."); }
  };
  return <>
    <section className="border-b border-blue-200 bg-blue-50 px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex items-center gap-2 font-bold text-blue-700"><Users className="h-4 w-4" />함께 테스트 · {role === "referee" ? "심판" : "관리자"}</div>
        <h1 className="text-2xl font-black">같은 경기, 두 개의 화면</h1>
        <p className="text-sm">심판이 경기를 운영하고 관리자는 점수·교체·MOM을 실시간으로 확인합니다.</p>
        <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-white px-3 py-1">심판 {state.referee ? "접속" : "대기"}</span><span className="rounded-full bg-white px-3 py-1">관리자 {state.admin ? "접속" : "대기"}</span><span role="status" className={`rounded-full px-3 py-1 font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{duplicate ? "같은 역할이 이미 접속 중" : !state.connected ? "연결 중 · 조작 잠김" : !state.referee ? "심판 입장 대기" : !state.ready ? "경기 동기화 중 · 조작 잠김" : "실시간 연결됨"}</span></div>
        <div className="flex flex-wrap gap-2">{(["referee", "admin"] as const).map(target => <Button key={target} variant="outline" onClick={() => copy(target)}><Copy className="mr-2 h-4 w-4" />{target === "referee" ? "심판" : "관리자"} 링크 복사</Button>)}</div>
        <div className="flex gap-4 text-sm underline"><a href={roomLink(location.origin, room, "referee")}>심판 입장 링크</a><a href={roomLink(location.origin, room, "admin")}>관리자 입장 링크</a></div>
        {copied && <p role="status" className="text-sm">{copied}</p>}
        <p className="text-xs leading-relaxed text-slate-600">두 화면을 열어두고 사용하세요. 심판이 나가면 진행이 멈추고, 재접속하면 일시정지 상태로 이어집니다. 링크가 있는 사람은 연습 역할로 참여할 수 있으며 실제 계정 권한·기록에는 영향이 없습니다.</p>
        {(state.error || duplicate) && <p role="alert" className="text-sm font-semibold text-amber-900">{duplicate ? "심판 1명·관리자 1명만 조작할 수 있습니다. 먼저 열린 같은 역할의 화면을 닫아주세요." : state.error}</p>}
        {!active && <Button variant="outline" size="sm" onClick={() => location.reload()}>다시 연결</Button>}
      </div>
    </section>
    {role === "admin" ? <PracticeAdminView session={session} active={active} /> :
      active ? <SimulationWorkspace key={session.store.getState().snapshot.match.id} store={session.store} shared /> :
        <p className="mx-auto max-w-3xl p-6 text-sm" role="status">{duplicate ? "현재 심판이 운영 중입니다." : "심판 연결을 확인하고 경기 기록을 맞추고 있습니다."}</p>}
  </>;
}
