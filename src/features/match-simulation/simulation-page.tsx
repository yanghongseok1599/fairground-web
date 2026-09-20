"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { createPracticeStore } from "./store";
import { readPracticeSnapshot, savePracticeSnapshot } from "./persistence";

import { SimulationWorkspace } from "./simulation-workspace";
import { SharedRoomPage } from "./shared/room-page";
import { SharedRoomLobby } from "./shared/lobby";
import { isRoomId, type RoomRole } from "./shared/protocol";

const subscribeToHydration = () => () => undefined;

export function MatchSimulationPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return hydrated ? <SimulationEntry /> : <p className="p-8 text-center" role="status">테스트 경기를 준비하고 있습니다…</p>;
}

function SimulationEntry() {
  const [route] = useState(() => {
    const params = new URLSearchParams(location.search);
    const role = params.get("role");
    return { room: params.get("room"), solo: params.get("mode") === "solo", role: role === "referee" || role === "admin" || role === "spectator" ? role as RoomRole : undefined };
  });
  if (route.room) return isRoomId(route.room)
    ? <SharedRoomPage room={route.room} role={route.role} />
    : <p role="alert" className="p-8">공유 링크가 올바르지 않습니다. <a className="underline" href="/match-simulation">새 테스트 경기 만들기</a></p>;
  if (!route.solo) return <SharedRoomLobby />;
  return <>
    <section className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-muted-foreground">혼자 연습 · 이 화면의 경기는 다른 기기와 공유되지 않습니다.</p>
      <Button asChild variant="outline"><a href="/match-simulation">공유 경기 목록으로</a></Button>
    </section>
    <SavedSimulation />
  </>;
}

function SavedSimulation() {
  const [initial] = useState(() => {
    try { return { store: createPracticeStore(readPracticeSnapshot(window.sessionStorage)), notice: "" }; }
    catch { return { store: createPracticeStore(), notice: "이전 연습 기록을 불러오지 못해 새 테스트 경기를 준비했습니다." }; }
  });
  const store = initial.store;
  const [storageNotice, setStorageNotice] = useState(initial.notice);
  useEffect(() => store.subscribe(() => {
    try { savePracticeSnapshot(window.sessionStorage, store.getState().snapshot); }
    catch { setStorageNotice("이 브라우저에서는 기록을 보관할 수 없습니다. 현재 화면에서 계속 연습할 수 있습니다."); }
  }), [store]);
  return <SimulationWorkspace store={store} storageNotice={storageNotice} />;
}
