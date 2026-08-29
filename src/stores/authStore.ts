"use client";

import { create } from "zustand";
import { supabase, isDemoMode } from "@/config/supabase";
import { SITE_URL } from "@/lib/site-config";
import { rowToPlayer, playerToInsert, playerPatchToRow } from "@/lib/mappers";
import { DEFAULT_CARD_PHOTO_SCALE } from "@/lib/player-profile-photo";
import {
  clearPendingCardSkin,
  GROUND_CHALLENGE_PLAYER_CARD_SKIN,
  readPendingCardSkin,
} from "@/lib/player-card-skin";
import type { Gender, Player, PlayerCardSkin, PlayerRole, Position, TeamRole } from "@/types";

type FairGroundOAuthProvider = "google" | "kakao";

// Supabase auth.users 를 앱 전반이 쓰는 최소 형태로 노출.
// Firebase User.uid 호환을 위해 Supabase user.id 를 uid 로 매핑.
export interface AuthUser {
  uid: string;
  email: string | null;
  gender?: Gender;
}

// ===== localStorage helpers for demo mode =====
const LS_USERS = "fg_users";
const LS_PLAYERS = "fg_players";
const LS_SESSION = "fg_session";
const LS_DEV_ADMIN_SESSION = "fg_dev_admin_session";
const SHORT_ID_DOMAIN = "fairground.local";
const LOCAL_ADMIN_EMAIL = `admin@${SHORT_ID_DOMAIN}`;
const LOCAL_ADMIN_PASSWORD = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD?.trim() ?? "";

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

function normalizeAuthGender(value: unknown): Gender | undefined {
  return value === "male" ||
    value === "female" ||
    value === "other" ||
    value === "prefer_not_to_say"
    ? value
    : undefined;
}

function makeUser(uid: string, email: string | null, gender?: Gender | null): AuthUser {
  return { uid, email, ...(gender ? { gender } : {}) };
}

function normalizeLoginId(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return trimmed;
  return trimmed.includes("@") ? trimmed : `${trimmed}@${SHORT_ID_DOMAIN}`;
}

function canUseLocalAdminOverride(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (!isDemoMode) return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function isLocalAdminCredentials(email: string, password: string): boolean {
  return (
    LOCAL_ADMIN_PASSWORD.length > 0 &&
    normalizeLoginId(email) === LOCAL_ADMIN_EMAIL &&
    password.trim() === LOCAL_ADMIN_PASSWORD
  );
}

function isLocalAdminLogin(email: string, password: string): boolean {
  return canUseLocalAdminOverride() && isLocalAdminCredentials(email, password);
}

function getAuthRedirectOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  return SITE_URL;
}

async function startOAuthSignIn(
  provider: FairGroundOAuthProvider,
  returnTo?: string,
): Promise<void> {
  if (isDemoMode) {
    const providerName = provider === "kakao" ? "카카오" : "Google";
    throw new Error(`데모 모드에서는 ${providerName} 로그인을 사용할 수 없습니다. 이메일로 가입해주세요.`);
  }

  // OAuth 리다이렉트 플로우 (implicit — 토큰이 URL hash 로 복귀).
  // /auth/callback 클라이언트 페이지가 detectSessionInUrl 처리를 기다린 뒤
  // returnTo 로 이동한다. 세션 감지/프로필 자동생성은 init()이 수행한다.
  let redirectTo: string | undefined;
  if (typeof window !== "undefined") {
    const callbackUrl = new URL("/auth/callback", getAuthRedirectOrigin());
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      callbackUrl.searchParams.set("returnTo", returnTo);
    }
    redirectTo = callbackUrl.toString();
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}

function getOAuthDisplayName(userMetadata: Record<string, unknown>, email: string | null): string {
  for (const key of ["name", "full_name", "preferred_username", "user_name", "nickname"]) {
    const value = userMetadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return email ?? "";
}

function makePlayer(
  uid: string,
  name: string,
  phone: string,
  teamId = "",
  extra: Partial<Pick<Player, "email" | "gender" | "birthDate" | "hasPlayerExperience" | "cardSkin">> = {},
): Player {
  return {
    id: uid,
    uid,
    name,
    number: 0,
    position: "ALA" as Position,
    teamId,
    nationality: "KOR",
    photoUrl: "",
    photoScale: DEFAULT_CARD_PHOTO_SCALE,
    cardType: "gold",
    cardSkin: extra.cardSkin ?? "standard",
    cardRating: 70,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: false,
    role: "player",
    phone,
    email: extra.email,
    gender: extra.gender,
    birthDate: extra.birthDate,
    hasPlayerExperience: extra.hasPlayerExperience ?? false,
    createdAt: Date.now(),
  };
}

function makeLocalAdminPlayer(): Player {
  return {
    id: "local-dev-admin",
    uid: "local-dev-admin",
    name: "관리자",
    number: 0,
    position: "ALA" as Position,
    teamId: "",
    nationality: "KOR",
    photoUrl: "",
    photoScale: DEFAULT_CARD_PHOTO_SCALE,
    cardType: "premium",
    cardSkin: "standard",
    cardRating: 100,
    stats: { goals: 0, assists: 0, games: 0, mom: 0 },
    badges: [],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "admin",
    email: LOCAL_ADMIN_EMAIL,
    createdAt: Date.now(),
  };
}

function saveLocalAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_DEV_ADMIN_SESSION, "1");
}

function clearLocalAdminSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_DEV_ADMIN_SESSION);
}

function hasLocalAdminSession(): boolean {
  if (!canUseLocalAdminOverride()) return false;
  return localStorage.getItem(LS_DEV_ADMIN_SESSION) === "1";
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
  gender: Gender;
  birthDate: string;
  hasPlayerExperience: boolean;
  teamId?: string;
  cardSkin?: PlayerCardSkin;
}

interface CreatePlayerData {
  name: string;
  number: number;
  position: Position;
  role?: Exclude<PlayerRole, "admin">;
  teamId: string;
  nationality: string;
  gender?: Gender;
  photoUrl?: string;
  profilePhotoUrl?: string;
  profilePhotoLocked?: boolean;
  photoScale?: number;
  teamRole?: TeamRole;
  cardSkin?: PlayerCardSkin;
  // 선수카드 등록 화면에서 받은 촬영물 홍보 활용 동의 시각(ms).
  portraitConsentAt?: number;
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
  loginWithKakao: (returnTo?: string) => Promise<void>;
  /** 비밀번호 재설정 메일 발송. 짧은 ID(@fairground.local) 계정은 거부한다. */
  requestPasswordReset: (loginId: string) => Promise<void>;
  /** 로그인/복구 세션 상태에서 새 비밀번호 저장. */
  updatePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePlayer: (data: Partial<Player>) => Promise<void>;
  uploadPlayerPhoto: (file: File) => Promise<string>;
  clearError: () => void;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((setState, getState) => ({
  user: null,
  player: null,
  loading: false,
  error: null,
  initialized: false,

  login: async (email, password) => {
    setState({ loading: true, error: null });
    try {
      const normalizedEmail = normalizeLoginId(email);
      const normalizedPassword = password.trim();
      if (isLocalAdminLogin(email, normalizedPassword)) {
        const admin = makeLocalAdminPlayer();
        saveLocalAdminSession();
        setState({
          user: makeUser(admin.uid, LOCAL_ADMIN_EMAIL),
          player: admin,
          loading: false,
          initialized: true,
        });
        return;
      }
      if (isDemoMode) {
        const users = getLocalUsers();
        const found = users.find((u) => u.email === normalizedEmail && u.password === normalizedPassword);
        if (!found) {
          throw new Error("아이디 또는 비밀번호가 올바르지 않습니다");
        }
        const players = getLocalPlayers();
        const player = players[found.uid] || null;
        saveSession(found.uid);
        setState({ user: makeUser(found.uid, normalizedEmail), player, loading: false });
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      if (error) throw new Error("아이디 또는 비밀번호가 올바르지 않습니다");
      const uid = data.user.id;
      const player = await fetchProfile(uid);
      setState({ user: makeUser(uid, data.user.email ?? normalizedEmail), player, loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  register: async (data) => {
    setState({ loading: true, error: null });
    try {
      const normalizedEmail = normalizeLoginId(data.email);
      if (isDemoMode) {
        const users = getLocalUsers();
        if (users.find((u) => u.email === normalizedEmail)) {
          throw new Error("이미 등록된 아이디입니다");
        }
        const uid = generateUid();
        users.push({ uid, email: normalizedEmail, password: data.password });
        saveLocalUsers(users);
        saveSession(uid);
        const player = makePlayer(uid, data.name, data.phone, data.teamId, {
          email: normalizedEmail,
          gender: data.gender,
          birthDate: data.birthDate,
          hasPlayerExperience: data.hasPlayerExperience,
          cardSkin: data.cardSkin,
        });
        const players = getLocalPlayers();
        players[uid] = player;
        saveLocalPlayers(players);
        setState({ user: makeUser(uid, normalizedEmail), player, loading: false });
        return;
      }
      // 프로필 생성은 클라이언트 INSERT가 아니라 auth.users 트리거
      // (public.handle_new_user, SECURITY DEFINER)가 서버측에서 수행한다.
      // 이렇게 하면 "Confirm email" 설정/세션 유무와 무관하게 프로필이 항상 생성된다.
      // (이전엔 세션 없는 signUp 직후의 클라이언트 INSERT가 profiles RLS에 막혀
      //  "new row violates row-level security policy" 로 가입이 실패했다.)
      // 사용자 입력값은 user_metadata(raw_user_meta_data)로 트리거에 전달한다.
      const { data: signUp, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: data.password,
        options: {
          data: {
            name: data.name,
            phone: data.phone,
            gender: data.gender || "",
            birth_date: data.birthDate || "",
            has_player_experience: data.hasPlayerExperience,
            team_id: data.teamId || "",
            card_skin: data.cardSkin ?? "standard",
          },
        },
      });
      if (error) throw new Error(error.message);
      if (!signUp.user) throw new Error("가입에 실패했습니다");
      const uid = signUp.user.id;
      // 트리거가 생성한 행과 동일한 기본값으로 로컬 상태를 구성(즉시 UI 반영용).
      // 실제 영속화는 트리거가 담당하며, 다음 init()의 fetchProfile이 정본을 읽어온다.
      const player = makePlayer(uid, data.name, data.phone, data.teamId, {
        email: normalizedEmail,
        gender: data.gender,
        birthDate: data.birthDate,
        hasPlayerExperience: data.hasPlayerExperience,
        cardSkin: data.cardSkin,
      });
      setState({
        user: makeUser(uid, signUp.user.email ?? normalizedEmail, data.gender),
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
      const currentUser = getState().user;
      const existingPlayer = getState().player;
      const uid = isDemoMode ? generateUid() : currentUser?.uid;
      if (!uid) {
        throw new Error("로그인이 필요합니다");
      }
      const player: Player = {
        id: uid,
        uid,
        name: data.name,
        number: data.number,
        position: data.position,
        teamId: data.teamId,
        photoUrl: data.photoUrl || "",
        profilePhotoUrl: data.profilePhotoUrl || data.photoUrl || "",
        profilePhotoLocked: data.profilePhotoLocked ?? false,
        photoScale: data.photoScale ?? DEFAULT_CARD_PHOTO_SCALE,
        cardType: existingPlayer?.cardType ?? "gold",
        cardSkin: data.cardSkin ?? existingPlayer?.cardSkin ?? "standard",
        cardRating: existingPlayer?.cardRating ?? 70,
        stats: existingPlayer?.stats ?? { goals: 0, assists: 0, games: 0, mom: 0 },
        badges: existingPlayer?.badges ?? [],
        penaltyStatus: existingPlayer?.penaltyStatus ?? {
          isBanned: false,
          banMatchesRemaining: 0,
          seasonYellowCards: 0,
        },
        isApproved: existingPlayer?.isApproved ?? false,
        role: data.role ?? existingPlayer?.role ?? "player",
        teamRole: data.teamRole ?? existingPlayer?.teamRole,
        nationality: data.nationality || "KOR",
        gender: data.gender ?? existingPlayer?.gender ?? currentUser?.gender,
        // 한 번 남은 동의 시각은 재등록/수정 시에도 덮어쓰지 않는다 —
        // 최초 동의 시점이 증거로서의 의미를 가지기 때문.
        portraitConsentAt: existingPlayer?.portraitConsentAt ?? data.portraitConsentAt,
        createdAt: existingPlayer?.createdAt ?? Date.now(),
      };
      if (isDemoMode) {
        const players = getLocalPlayers();
        players[uid] = player;
        saveLocalPlayers(players);
        saveSession(uid);
        setState({ user: makeUser(uid, `${uid}@anonymous.local`), player, loading: false });
        return;
      }
      const existing = existingPlayer ?? await fetchProfile(uid);
      if (existing) {
        const { error } = await supabase
          .from("profiles")
          .update(playerPatchToRow(player))
          .eq("id", uid);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("profiles").insert(playerToInsert(player));
        if (error) throw new Error(error.message);
      }
      setState({ player, loading: false });
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  loginWithGoogle: async (returnTo?: string) => {
    setState({ loading: true, error: null });
    try {
      await startOAuthSignIn("google", returnTo);
      // 리다이렉트되므로 여기서 setState 불필요(페이지 이탈).
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  loginWithKakao: async (returnTo?: string) => {
    setState({ loading: true, error: null });
    try {
      await startOAuthSignIn("kakao", returnTo);
      // 리다이렉트되므로 여기서 setState 불필요(페이지 이탈).
    } catch (e) {
      setState({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  // 비밀번호 재설정 메일 발송.
  //
  // 짧은 ID 가입자는 auth 이메일이 `<id>@fairground.local` 이라 메일이 닿지
  // 않는다. 조용히 성공한 척하면 사용자가 오지 않는 메일을 기다리게 되므로
  // 명시적으로 안내한다. 반대로 실제 이메일 계정은 가입 여부를 노출하지
  // 않기 위해 존재 여부와 무관하게 동일한 응답을 준다(계정 열거 방지).
  requestPasswordReset: async (loginId) => {
    const email = normalizeLoginId(loginId);
    if (!email) throw new Error("아이디 또는 이메일을 입력해주세요.");
    if (email.endsWith(`@${SHORT_ID_DOMAIN}`)) {
      throw new Error(
        "아이디로 가입한 계정은 등록된 이메일이 없어 자동 재설정을 보낼 수 없습니다. 운영진에게 문의해주세요.",
      );
    }
    if (isDemoMode) {
      throw new Error("데모 모드에서는 비밀번호 재설정을 사용할 수 없습니다.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/auth/reset-password", getAuthRedirectOrigin()).toString(),
    });
    if (error) throw new Error(error.message);
  },

  updatePassword: async (newPassword) => {
    const password = newPassword.trim();
    if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");
    if (isDemoMode) {
      throw new Error("데모 모드에서는 비밀번호를 변경할 수 없습니다.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  logout: async () => {
    clearLocalAdminSession();
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
    if (hasLocalAdminSession()) {
      const admin = makeLocalAdminPlayer();
      setState({
        user: makeUser(admin.uid, LOCAL_ADMIN_EMAIL),
        player: admin,
        loading: false,
        initialized: true,
      });
      return () => {};
    }

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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sUser = session?.user;
      if (sUser) {
        const authGender = normalizeAuthGender(sUser.user_metadata?.gender);
        const current = getState();
        const hasHydratedSameUser =
          current.user?.uid === sUser.id && current.player !== null && current.initialized;

        setState({
          user: makeUser(sUser.id, sUser.email ?? null, authGender),
          player: hasHydratedSameUser ? current.player : null,
          loading: !hasHydratedSameUser,
          initialized: hasHydratedSameUser,
        });

        // Supabase auth callbacks must not await Supabase calls directly.
        // Defer profile I/O so signInWithPassword can resolve instead of hanging.
        setTimeout(() => {
          void (async () => {
            try {
              let player = await fetchProfile(sUser.id);
              const pendingCardSkin = readPendingCardSkin();
              // OAuth 최초 로그인 시 프로필 자동 생성.
              if (!player) {
                const created = makePlayer(
                  sUser.id,
                  getOAuthDisplayName(sUser.user_metadata ?? {}, sUser.email ?? null),
                  "",
                  "",
                  { email: sUser.email ?? undefined, gender: authGender, cardSkin: pendingCardSkin }
                );
                const { error } = await supabase.from("profiles").insert(playerToInsert(created));
                if (error) {
                  console.error("[authStore] auto-create profile failed:", error.message);
                } else {
                  if (pendingCardSkin) clearPendingCardSkin();
                  player = created;
                }
              } else if (
                pendingCardSkin === GROUND_CHALLENGE_PLAYER_CARD_SKIN &&
                player.cardSkin !== GROUND_CHALLENGE_PLAYER_CARD_SKIN
              ) {
                const { data, error } = await supabase
                  .from("profiles")
                  .update({ card_skin: GROUND_CHALLENGE_PLAYER_CARD_SKIN })
                  .eq("id", sUser.id)
                  .select("*")
                  .single();
                if (error) {
                  console.error("[authStore] apply pending card skin failed:", error.message);
                } else {
                  clearPendingCardSkin();
                  player = rowToPlayer(data);
                }
              }
              setState({
                user: makeUser(sUser.id, sUser.email ?? null, authGender),
                player,
                loading: false,
                initialized: true,
              });
            } catch {
              setState({
                user: makeUser(sUser.id, sUser.email ?? null, authGender),
                player: null,
                loading: false,
                initialized: true,
              });
            }
          })();
        }, 0);
      } else {
        setState({ user: null, player: null, loading: false, initialized: true });
      }
    });

    return () => sub.subscription.unsubscribe();
  },
}));
