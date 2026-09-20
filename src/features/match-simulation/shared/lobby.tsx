"use client";

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectRoomDirectory, type DirectoryState } from "./directory-transport";
import { roomLink } from "./protocol";

const initialState: DirectoryState = { connected: false, rooms: [], error: "" };

export function SharedRoomLobby() {
  const [directory, setDirectory] = useState(initialState);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => connectRoomDirectory(setDirectory), [attempt]);
  return <section className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-bold text-blue-700"><Users className="h-4 w-4" />함께 연습하는 테스트 경기</p>
      <h1 className="text-2xl font-black">공유 테스트 경기</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">다른 관리자가 개설한 경기도 여기에서 함께 확인하고 참여하세요. 실제 선수 기록에는 반영되지 않습니다.</p>
      <Button className="min-h-11" onClick={() => location.assign(roomLink(location.origin, crypto.randomUUID(), "admin"))}><Plus className="mr-2 h-4 w-4" />공유 테스트 경기 개설</Button>
    </div>
    <div className="space-y-3" aria-label="공유 경기 목록">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">접속 중인 경기 {directory.connected ? `${directory.rooms.length}개` : ""}</h2>
        <Button variant="outline" size="sm" onClick={() => { setDirectory(initialState); setAttempt((value) => value + 1); }}><RefreshCw className="mr-1 h-4 w-4" />목록 새로고침</Button>
      </div>
      {!directory.connected ? <p role={directory.error ? "alert" : "status"} className="rounded-xl border p-5 text-sm text-muted-foreground">{directory.error || "공유 경기를 불러오고 있습니다…"}</p> : directory.rooms.length === 0 ?
        <p role="status" className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">현재 접속 중인 공유 경기가 없습니다. 위에서 개설하면 다른 화면에도 바로 표시됩니다.</p> :
        <ul className="space-y-3">{directory.rooms.map((room) => <li key={room.room} data-room-id={room.room} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">테스트 경기 · {room.room.slice(0, 8)}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${room.refereeCount ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{room.refereeCount ? "심판 접속" : "심판 입장 대기"}</span>
          </div>
          <p className="text-sm text-muted-foreground">테스트 블루 vs 테스트 레드 · 관리자 {room.adminCount}명 접속</p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" onClick={() => location.assign(roomLink(location.origin, room.room, "admin"))}>관리자로 보기</Button>
            <Button variant="outline" className="min-h-11" disabled={room.refereeCount > 0} onClick={() => location.assign(roomLink(location.origin, room.room, "referee"))}>{room.refereeCount ? "심판 운영 중" : "심판으로 입장"}</Button>
          </div>
        </li>)}</ul>}
      <p className="text-xs leading-relaxed text-muted-foreground">누군가 방을 열어두는 동안 자동으로 공유됩니다. 모두 나가면 목록에서 사라집니다. 기존 방이 보이지 않으면 방을 연 화면도 한 번 새로고침해주세요.</p>
    </div>
    <div className="border-t pt-4 text-sm text-muted-foreground">기기에서만 연습하려면 <a className="font-semibold text-blue-700 underline" href="/match-simulation?mode=solo">혼자 연습</a>을 이용하세요.</div>
  </section>;
}
