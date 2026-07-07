import { create } from "zustand";
import type { SessionUser } from "./auth";

interface AppState {
  user: SessionUser | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  walletAddress: string | null;
  setUser: (user: SessionUser | null) => void;
  setWallet: (addr: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isLoading: true,
  needsOnboarding: false,
  walletAddress: null,
  setUser: (user) =>
    set({
      user,
      needsOnboarding: !!user && !user.username,
    }),
  setWallet: (walletAddress) => set({ walletAddress }),
  setLoading: (isLoading) => set({ isLoading }),
}));
