"use client";

import { create } from "zustand";
import { supabase, isDemoMode } from "@/config/supabase";
import { SITE_URL } from "@/lib/site-config";
import {
  rowToPlayer,
  playerToInsert,
  playerPatchToRow,
  selfEditablePlayerPatch,
} from "@/lib/mappers";
import { readPhotoFile, requireSavedRow, registrationError } from "@/lib/registration/reliability";
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
  const { data, error } = await supabase.rpc("get_my_profile").eq("id", uid).maybeSingle();
  if (error) {
    console.error("[authStore] fetchProfile failed:", error.message);
    throw new Error(error.message);
  }
  return data ? rowToPlayer(data) : null;
}

let authHydrationVersion = 0;

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
  refreshPlayer: () => Promise<Player | null>;
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
      setState({ error: registrationError(e), loading: false });
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
      if (!signUp.session) {
        // Email verification is not an authenticated session.
        setState({ user: null, player: null, loading: false });
        return;
      }
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
      setState({ error: registrationError(e), loading: false });
      throw e;
    }
  },

  createPlayer: async (data) => {
    setState({ loading: true, error: null });
    try {
      const currentUser = getState().user;
      const existingPlayer = isDemoMode ? getState().player : currentUser ? await fetchProfile(currentUser.uid) : null;
      const uid = isDemoMode ? generateUid() : currentUser?.uid;
      if (!uid) {
        throw new Error("로그인이 필요합니다");
      }
      if (data.role === "referee" && existingPlayer && existingPlayer.role !== "referee") {
        throw new Error("기존 계정의 심판 권한은 관리자가 승인해야 합니다. 선수로 등록을 마친 뒤 심판 등록을 문의해주세요.");
      }
      const player: Player = {
        ...existingPlayer,
        id: uid,
        uid,
        name: data.name,
        number: data.number,
        position: data.position,
        teamId: existingPlayer?.teamId ?? "",
        photoUrl: data.photoUrl || existingPlayer?.photoUrl || "",
        profilePhotoUrl: existingPlayer?.profilePhotoLocked ? existingPlayer.profilePhotoUrl
          : data.profilePhotoUrl || data.photoUrl || existingPlayer?.profilePhotoUrl || "",
        profilePhotoLocked: existingPlayer?.profilePhotoLocked ?? data.profilePhotoLocked ?? false,
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
        role: existingPlayer?.role ?? "player",
        teamRole: existingPlayer?.teamRole,
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
      let savedPlayer: Player;
      if (existingPlayer) {
        // Only submitted card fields: never resubmit membership, stats, badges,
        // approval, role, or a stale consent timestamp from an earlier read.
        const patch = {
          name: player.name, number: player.number, position: player.position,
          nationality: player.nationality, photoScale: player.photoScale,
          cardSkin: player.cardSkin,
          ...(data.photoUrl ? { photoUrl: data.photoUrl } : {}),
          ...(!existingPlayer.profilePhotoLocked && data.profilePhotoUrl
            ? { profilePhotoUrl: data.profilePhotoUrl } : {}),
          ...(!existingPlayer.portraitConsentAt && data.portraitConsentAt
            ? { portraitConsentAt: data.portraitConsentAt } : {}),
        };
        const { data: saved, error } = await supabase
          .from("profiles")
          .update(playerPatchToRow(patch))
          .eq("id", uid).select("*").single();
        savedPlayer = rowToPlayer(requireSavedRow(saved, error));
      } else {
        const { data: saved, error } = await supabase.from("profiles")
          .insert(playerToInsert(player)).select("*").single();
        savedPlayer = rowToPlayer(requireSavedRow(saved, error));
      }
      if (getState().user?.uid === uid) setState({ player: savedPlayer, loading: false });
    } catch (e) {
      setState({ error: registrationError(e), loading: false });
      throw e;
    }
  },

  loginWithGoogle: async (returnTo?: string) => {
    setState({ loading: true, error: null });
    try {
      await startOAuthSignIn("google", returnTo);
      // 리다이렉트되므로 여기서 setState 불필요(페이지 이탈).
    } catch (e) {
      setState({ error: registrationError(e), loading: false });
      throw e;
    }
  },

  loginWithKakao: async (returnTo?: string) => {
    setState({ loading: true, error: null });
    try {
      await startOAuthSignIn("kakao", returnTo);
      // 리다이렉트되므로 여기서 setState 불필요(페이지 이탈).
    } catch (e) {
      setState({ error: registrationError(e), loading: false });
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

  refreshPlayer: async () => {
    const state = getState();
    if (!state.user) return null;
    if (isDemoMode) {
      const player = getLocalPlayers()[state.user.uid] ?? null;
      setState({ player });
      return player;
    }
    const player = await fetchProfile(state.user.uid);
    setState({ player });
    return player;
  },

  updatePlayer: async (data) => {
    const state = useAuthStore.getState();
    if (!state.user || !state.player) throw new Error("로그인 정보가 없습니다. 입력을 유지한 채 다시 로그인해주세요.");

    if (isDemoMode) {
      const updated = { ...state.player, ...data };
      const players = getLocalPlayers();
      players[state.user.uid] = updated;
      saveLocalPlayers(players);
      setState({ player: updated });
      return;
    }

    // 팀 소속/역할은 전용 RPC만 변경한다. 같은 값을 다시 보내는 기존 화면은
    // no-op으로 제거하고, 실제 변경 시도는 명시적으로 거부한다.
    const editableData = selfEditablePlayerPatch(data, state.player);
    if (Object.keys(editableData).length === 0) return;

    // RLS: 본인 행만, 특권컬럼은 DB trigger가 최종 거부.
    const { data: saved, error } = await supabase
      .from("profiles")
      .update(playerPatchToRow(editableData))
      .eq("id", state.user.uid).select("id").single();
    if (error) {
      console.error("[authStore] updatePlayer failed:", error.message);
      setState({ error: error.message });
      throw new Error(error.message);
    }
    requireSavedRow(saved, error);
    if (getState().user?.uid === state.user.uid) {
      setState({ player: { ...(getState().player ?? state.player), ...editableData } });
    }
  },

  uploadPlayerPhoto: readPhotoFile,

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
      const hydrationVersion = ++authHydrationVersion;
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
              if (hydrationVersion !== authHydrationVersion) return;
              const playerBeforeRead = getState().player;
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
                const { error } = await supabase
                  .from("profiles")
                  .update({ card_skin: GROUND_CHALLENGE_PLAYER_CARD_SKIN })
                  .eq("id", sUser.id);
                if (error) {
                  console.error("[authStore] apply pending card skin failed:", error.message);
                } else {
                  clearPendingCardSkin();
                  player = await fetchProfile(sUser.id);
                }
              }
              if (hydrationVersion !== authHydrationVersion) return;
              // A form may have committed while the auth refresh was reading.
              // Keep its newer local record until the next authoritative refresh.
              const latest = getState();
              if (latest.user?.uid === sUser.id && latest.player !== playerBeforeRead && latest.player) player = latest.player;
              setState({
                user: makeUser(sUser.id, sUser.email ?? null, authGender),
                player,
                loading: false,
                initialized: true,
              });
            } catch (e) {
              if (hydrationVersion !== authHydrationVersion) return;
              const latest = getState();
              setState({
                user: makeUser(sUser.id, sUser.email ?? null, authGender),
                player: latest.user?.uid === sUser.id ? latest.player : null,
                error: registrationError(e, "프로필을 불러오지 못했습니다. 다시 확인해주세요."),
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
