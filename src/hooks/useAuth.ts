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
    logout: store.logout,
    updatePlayer: store.updatePlayer,
    uploadPlayerPhoto: store.uploadPlayerPhoto,
    clearError: store.clearError,
  };
}
