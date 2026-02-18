"use client";

import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, database, storage, isDemoMode } from "@/config/firebase";
import type { Player, Position } from "@/types";

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

function makeDemoUser(uid: string, email: string): User {
  return { uid, email } as User;
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
  user: User | null;
  player: Player | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  createPlayer: (data: CreatePlayerData) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
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
        setState({
          user: makeDemoUser(found.uid, email),
          player,
          loading: false,
        });
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
      setState({ loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  register: async (data) => {
    setState({ loading: true, error: null });
    try {
      const makePlayer = (uid: string): Player => ({
        id: uid,
        uid,
        name: data.name,
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
        phone: data.phone,
        createdAt: Date.now(),
      });

      if (isDemoMode) {
        const users = getLocalUsers();
        if (users.find((u) => u.email === data.email)) {
          throw new Error("이미 등록된 이메일입니다");
        }
        const uid = generateUid();
        users.push({ uid, email: data.email, password: data.password });
        saveLocalUsers(users);
        saveSession(uid);
        const player = makePlayer(uid);
        const players = getLocalPlayers();
        players[uid] = player;
        saveLocalPlayers(players);
        setState({ user: makeDemoUser(uid, data.email), player, loading: false });
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const uid = cred.user.uid;
      const player = makePlayer(uid);
      await set(ref(database, `players/${uid}`), player);
      setState({ player, loading: false });
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
      await set(ref(database, `players/${uid}`), player);
      setState({ player, loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  loginWithGoogle: async () => {
    setState({ loading: true, error: null });
    try {
      if (isDemoMode) {
        throw new Error("데모 모드에서는 Google 로그인을 사용할 수 없습니다. 이메일로 가입해주세요.");
      }
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;
      // Auto-create player if not exists
      const snap = await get(ref(database, `players/${uid}`));
      if (!snap.exists()) {
        const player: Player = {
          id: uid,
          uid,
          name: result.user.displayName || "",
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
          phone: "",
          createdAt: Date.now(),
        };
        await set(ref(database, `players/${uid}`), player);
        setState({ player, loading: false });
      } else {
        setState({ player: snap.val() as Player, loading: false });
      }
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
    await signOut(auth);
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

    await update(ref(database, `players/${state.user.uid}`), data);
    setState({ player: { ...state.player, ...data } });
  },

  uploadPlayerPhoto: async (file) => {
    const state = useAuthStore.getState();
    if (!state.user) return "";

    // Storage CORS 우회: base64 data URL로 RTDB에 직접 저장
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
          user: localUser ? makeDemoUser(uid, localUser.email) : null,
          player: localUser ? player : null,
          loading: false,
          initialized: true,
        });
      } else {
        setState({ loading: false, initialized: true });
      }
      return () => {};
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
          const snap = await Promise.race([
            get(ref(database, `players/${user.uid}`)),
            timeout,
          ]);
          const player = snap && "exists" in snap && snap.exists() ? (snap.val() as Player) : null;
          setState({ user, player, loading: false, initialized: true });
        } catch {
          setState({ user, player: null, loading: false, initialized: true });
        }
      } else {
        setState({ user: null, player: null, loading: false, initialized: true });
      }
    });
    return unsubscribe;
  },
}));
