"use client";

import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const store = useAuthStore();

  return {
    user: store.user,
    player: store.player,
    loading: store.loading,
    error: store.error,
    initialized: store.initialized,
    login: store.login,
    register: store.register,
    createPlayer: store.createPlayer,
    loginWithGoogle: store.loginWithGoogle,
    loginWithKakao: store.loginWithKakao,
    requestPasswordReset: store.requestPasswordReset,
    updatePassword: store.updatePassword,
    logout: store.logout,
    updatePlayer: store.updatePlayer,
    leaveTeam: store.leaveTeam,
    uploadPlayerPhoto: store.uploadPlayerPhoto,
    clearError: store.clearError,
  };
}
