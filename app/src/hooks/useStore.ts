import { create } from 'zustand';
import type { User, Alert } from '../types';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;

  // Alerts
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  selectedAlert: Alert | null;
  setSelectedAlert: (alert: Alert | null) => void;

  // UI
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  selectedAlert: null,
  setSelectedAlert: (alert) => set({ selectedAlert: alert }),

  // UI
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));
