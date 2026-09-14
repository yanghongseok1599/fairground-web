"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Command, EventState, Output } from "./types";
import { createRequestId } from "./request-id";

export const operatorKey = (id: string) => `fg-alliance-operator:${id}`;
export interface RecentEvent {
  id: string;
  title: string;
  demo: boolean;
}
export function saveRecent(event: RecentEvent, token: string) {
  localStorage.setItem(operatorKey(event.id), token);
  const recent = readRecent().filter((e) => e.id !== event.id);
  localStorage.setItem(
    "fg-alliance-recent",
    JSON.stringify([event, ...recent].slice(0, 15)),
  );
}
export function readRecent(): RecentEvent[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("fg-alliance-recent") ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (item): item is RecentEvent =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.demo === "boolean",
        )
      : [];
  } catch {
    return [];
  }
}

interface Envelope {
  state?: EventState;
  output?: Output;
  version?: number;
  serverTime: number;
  requestIds?: string[];
  error?: string;
}
interface Pending {
  command: Command;
  requestId: string;
  version: number;
}

export function useEventConnection(id: string, control: boolean) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<EventState | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [offset, setOffset] = useState(0);
  const latestVersion = useRef(-1);
  const latestState = useRef<EventState | null>(null);
  const pending = useRef<Pending | null>(null);
  const sending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (control) {
      queueMicrotask(() => {
        const fragment = new URLSearchParams(location.hash.slice(1)).get(
          "token",
        );
        try {
          const stored = fragment ?? localStorage.getItem(operatorKey(id));
          if (fragment) {
            localStorage.setItem(operatorKey(id), fragment);
            history.replaceState(null, "", location.pathname + location.search);
          }
          setToken(stored);
          if (!stored)
            setError(
              "운영 전용 링크로 접속해 주세요. 출력 화면 주소에는 운영 권한이 없습니다.",
            );
        } catch {
          if (fragment) setToken(fragment);
          setError(
            fragment
              ? "운영 권한을 이 브라우저에 보관하지 못했습니다. 운영 링크를 보관해 주세요. 현재 창에서는 계속 진행할 수 있습니다."
              : "운영 권한을 읽지 못했습니다. 운영 전용 링크로 접속해 주세요.",
          );
        }
      });
    }
    return () => {
      mounted.current = false;
    };
  }, [id, control]);

  const accept = useCallback((data: Envelope, sentAt: number) => {
    if (!mounted.current) return;
    setOffset(data.serverTime - (sentAt + Date.now()) / 2);
    const version = data.state?.version ?? data.version ?? -1;
    if (version >= latestVersion.current) {
      latestVersion.current = version;
      if (data.state) {
        latestState.current = data.state;
        setState(data.state);
        setOutput(data.state.output);
      } else if (data.output) setOutput(data.output);
    }
    if (
      pending.current &&
      (data.requestIds?.includes(pending.current.requestId) ||
        version > pending.current.version)
    ) {
      pending.current = null;
      setUncertain(false);
    }
    setConnected(true);
  }, []);

  useEffect(() => {
    if (control && !token) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let abort: AbortController;
    const poll = async () => {
      abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 6000);
      const sentAt = Date.now();
      try {
        const response = await fetch(`/api/alliance-events/${id}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abort.signal,
        });
        const data: Envelope = await response.json();
        if (!response.ok)
          throw new Error(data.error || "중계 서버에 연결하지 못했습니다.");
        if (!stopped) accept(data, sentAt);
      } catch (e) {
        if (!stopped) {
          setConnected(false);
          if (!latestState.current && control)
            setError(e instanceof Error ? e.message : "연결을 확인해 주세요.");
        }
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, control ? 1000 : 400);
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      abort?.abort();
    };
  }, [id, control, token, accept]);

  const transmit = useCallback(
    async (request: Pending) => {
      if (sending.current || !token) return false;
      sending.current = true;
      setBusy(true);
      setError("");
      pending.current = request;
      try {
        const sentAt = Date.now();
        const response = await fetch(`/api/alliance-events/${id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(8000),
        });
        const data: Envelope = await response.json();
        if (!response.ok) {
          if (response.status < 500) {
            pending.current = null;
            setUncertain(false);
          }
          throw new Error(data.error || "저장하지 못했습니다.");
        }
        accept(data, sentAt);
        pending.current = null;
        setUncertain(false);
        return true;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "연결이 끊겼습니다. 같은 저장 요청으로 다시 확인해 주세요.",
        );
        setUncertain(Boolean(pending.current));
        return false;
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [id, token, accept],
  );

  const send = useCallback(
    (command: Command, version?: number) => {
      if (pending.current) {
        setError("이전 저장 결과를 확인한 뒤 진행해 주세요.");
        return Promise.resolve(false);
      }
      return transmit({
        command,
        version: version ?? latestState.current?.version ?? -1,
        requestId: createRequestId(),
      });
    },
    [transmit],
  );
  const retry = () =>
    pending.current ? transmit(pending.current) : Promise.resolve(false);
  return {
    state,
    output,
    token,
    connected,
    error,
    setError,
    busy,
    uncertain,
    send,
    retry,
    offset,
  };
}

export function useServerNow(offset = 0) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const timer = setInterval(tick, 100);
    tick();
    return () => clearInterval(timer);
  }, [offset]);
  return now;
}
