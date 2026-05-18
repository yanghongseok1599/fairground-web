"use client";

import { create } from "zustand";
import { supabase, isDemoMode } from "@/config/supabase";
import { rowToPlayer, playerToInsert, playerPatchToRow } from "@/lib/mappers";
import type { Player, Position } from "@/types";

// Supabase auth.users 를 앱 전반이 쓰는 최소 형태로 노출.
// Firebase User.uid 호환을 위해 Supabase user.id 를 uid 로 매핑.
export interface AuthUser {
  uid: string;
  email: string | null;
}

// ===== localStorage helpers for demo mode =====
const LS_USERS = "fg_users";
const LS_PLAYERS = "fg_players";
const LS_SESSION = "fg_session";

interface LocalUser {
  uid: string;
  email: string;
  password: string;
}

function getLocalUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_USERS) || "[]");
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUser[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function getLocalPlayers(): Record<string, Player> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_PLAYERS) || "{}");
  } catch {
    return {};
  }
}

function saveLocalPlayers(players: Record<string, Player>) {
  localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
}

function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_SESSION);
}

function saveSession(uid: string) {
  localStorage.setItem(LS_SESSION, uid);
}

function clearSession() {
  localStorage.removeItem(LS_SESSION);
}

function generateUid(): string {
  return "local_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function makeUser(uid: string, email: string | null): AuthUser {
  return { uid, email };
}

function makePlayer(uid: string, name: string, phone: string): Player {
  return {
    id: uid,
    uid,
    name,
    number: 0,
    position: "ALA" as Position,
    teamId: "",
    nationality: "KOR",
    photoUrl: "",
    photoScale: 1,
    cardType: "gold",
    cardRating: 90,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: false,
    role: "player",
    phone,
    createdAt: Date.now(),
  };
}

// 프로필 행 조회 (없으면 null). 에러는 호출부에 표면화(은폐 catch 금지 — D-H).
async function fetchProfile(uid: string): Promise<Player | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) {
    console.error("[authStore] fetchProfile failed:", error.message);
    throw new Error(error.message);
  }
  return data ? rowToPlayer(data) : null;
}

// ===== Store =====
interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface CreatePlayerData {
  name: string;
  number: number;
  position: Position;
  teamId: string;
  nationality: string;
  photoUrl?: string;
  profilePhotoUrl?: string;
  photoScale?: number;
}

interface AuthState {
  user: AuthUser | null;
  player: Player | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  createPlayer: (data: CreatePlayerData) => Promise<void>;
  loginWithGoogle: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePlayer: (data: Partial<Player>) => Promise<void>;
  uploadPlayerPhoto: (file: File) => Promise<string>;
  clearError: () => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((setState) => ({
  user: null,
  player: null,
  loading: false,
  error: null,
  initialized: false,

  login: async (email, password) => {
    setState({ loading: true, error: null });
    try {
      if (isDemoMode) {
        const users = getLocalUsers();
        const found = users.find((u) => u.email === email && u.password === password);
        if (!found) {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다");
        }
        const players = getLocalPlayers();
        const player = players[found.uid] || null;
        saveSession(found.uid);
        setState({ user: makeUser(found.uid, email), player, loading: false });
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const uid = data.user.id;
      const player = await fetchProfile(uid);
      setState({ user: makeUser(uid, data.user.email ?? email), player, loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  register: async (data) => {
    setState({ loading: true, error: null });
    try {
      if (isDemoMode) {
        const users = getLocalUsers();
        if (users.find((u) => u.email === data.email)) {
          throw new Error("이미 등록된 이메일입니다");
        }
        const uid = generateUid();
        users.push({ uid, email: data.email, password: data.password });
        saveLocalUsers(users);
        saveSession(uid);
        const player = makePlayer(uid, data.name, data.phone);
        const players = getLocalPlayers();
        players[uid] = player;
        saveLocalPlayers(players);
        setState({ user: makeUser(uid, data.email), player, loading: false });
        return;
      }
      const { data: signUp, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      if (error) throw new Error(error.message);
      if (!signUp.user) throw new Error("가입에 실패했습니다");
      const uid = signUp.user.id;
      const player = makePlayer(uid, data.name, data.phone);
      // RLS: id = auth.uid() 인 행만 INSERT 허용. role/is_approved 는 DB 기본값.
      const { error: insErr } = await supabase.from("profiles").insert(playerToInsert(player));
      if (insErr) throw new Error(insErr.message);
      setState({
        user: makeUser(uid, signUp.user.email ?? data.email),
        player,
        loading: false,
      });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  createPlayer: async (data) => {
    setState({ loading: true, error: null });
    try {
      const state = useAuthStore.getState();
      if (!state.user) throw new Error("로그인이 필요합니다");
      const uid = state.user.uid;
      const player: Player = {
        id: uid,
        uid,
        name: data.name,
        number: data.number,
        position: data.position,
        teamId: data.teamId,
        photoUrl: data.photoUrl || "",
        profilePhotoUrl: data.profilePhotoUrl || data.photoUrl || "",
        photoScale: data.photoScale ?? 1,
        cardType: "gold",
        cardRating: 90,
        stats: { goals: 0, assists: 0, games: 0, mom: 0 },
        badges: [],
        penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
        isApproved: false,
        role: "player",
        nationality: data.nationality || "KOR",
        createdAt: Date.now(),
      };
      if (isDemoMode) {
        const players = getLocalPlayers();
        players[uid] = player;
        saveLocalPlayers(players);
        setState({ player, loading: false });
        return;
      }
      // upsert: 가입 시 행이 이미 있으면 갱신, 없으면 생성.
      const { error } = await supabase.from("profiles").upsert(playerToInsert(player));
      if (error) throw new Error(error.message);
      setState({ player, loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  loginWithGoogle: async (returnTo?: string) => {
    setState({ loading: true, error: null });
    try {
      if (isDemoMode) {
        throw new Error("데모 모드에서는 Google 로그인을 사용할 수 없습니다. 이메일로 가입해주세요.");
      }
      // OAuth 리다이렉트 플로우 (implicit — 토큰이 URL hash 로 복귀).
      // /auth/callback 클라 페이지가 detectSessionInUrl 처리를 기다린 뒤
      // returnTo 로 이동. 세션 감지/프로필 자동생성은 init()의
      // onAuthStateChange 가 수행한다.
      let redirectTo: string | undefined;
      if (typeof window !== "undefined") {
        const cb = new URL("/auth/callback", window.location.origin);
        if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
          cb.searchParams.set("returnTo", returnTo);
        }
        redirectTo = cb.toString();
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
      // 리다이렉트되므로 여기서 setState 불필요(페이지 이탈).
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  logout: async () => {
    if (isDemoMode) {
      clearSession();
      setState({ user: null, player: null });
      return;
    }
    await supabase.auth.signOut();
    setState({ user: null, player: null });
  },

  updatePlayer: async (data) => {
    const state = useAuthStore.getState();
    if (!state.user || !state.player) return;

    if (isDemoMode) {
      const updated = { ...state.player, ...data };
      const players = getLocalPlayers();
      players[state.user.uid] = updated;
      saveLocalPlayers(players);
      setState({ player: updated });
      return;
    }

    // RLS: 본인 행만, 특권컬럼(role/is_approved/stats)은 트리거가 거부.
    const { error } = await supabase
      .from("profiles")
      .update(playerPatchToRow(data))
      .eq("id", state.user.uid);
    if (error) {
      console.error("[authStore] updatePlayer failed:", error.message);
      setState({ error: error.message });
      throw new Error(error.message);
    }
    setState({ player: { ...state.player, ...data } });
  },

  uploadPlayerPhoto: async (file) => {
    const state = useAuthStore.getState();
    if (!state.user) return "";
    // NOTE(상용화 후속): 현재는 base64 data URL 반환(원 동작 보존).
    // Supabase Storage 버킷 업로드로 교체 예정 — DB에 대용량 base64 저장은 비효율.
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  },

  clearError: () => setState({ error: null }),

  init: () => {
    if (isDemoMode) {
      const uid = getSession();
      if (uid) {
        const players = getLocalPlayers();
        const player = players[uid] || null;
        const users = getLocalUsers();
        const localUser = users.find((u) => u.uid === uid);
        setState({
          user: localUser ? makeUser(uid, localUser.email) : null,
          player: localUser ? player : null,
          loading: false,
          initialized: true,
        });
      } else {
        setState({ loading: false, initialized: true });
      }
      return () => {};
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sUser = session?.user;
      if (sUser) {
        try {
          let player = await fetchProfile(sUser.id);
          // OAuth 최초 로그인 시 프로필 자동 생성.
          if (!player) {
            const created = makePlayer(
              sUser.id,
              (sUser.user_metadata?.full_name as string) || sUser.email || "",
              ""
            );
            const { error } = await supabase.from("profiles").insert(playerToInsert(created));
            if (error) {
              console.error("[authStore] auto-create profile failed:", error.message);
            } else {
              player = created;
            }
          }
          setState({
            user: makeUser(sUser.id, sUser.email ?? null),
            player,
            loading: false,
            initialized: true,
          });
        } catch {
          setState({
            user: makeUser(sUser.id, sUser.email ?? null),
            player: null,
            loading: false,
            initialized: true,
          });
        }
      } else {
        setState({ user: null, player: null, loading: false, initialized: true });
      }
    });

    return () => sub.subscription.unsubscribe();
  },
}));
