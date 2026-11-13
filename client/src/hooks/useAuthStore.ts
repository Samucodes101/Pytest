import { create } from 'zustand';
import { User } from '@/types';
import { apiClient } from '@/api/client';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, departmentId?: number) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  loadFromStorage: () => void;
}

/**
 * Read the saved session synchronously so the very first render already knows
 * who is signed in. Loading it in an effect instead made every page reload
 * bounce through /login to /dashboard.
 */
function readSession(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return token && user ? { token, user: JSON.parse(user) } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  ...readSession(),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.login(email, password);
      set({ user: data.user, token: data.token });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name: string, email: string, password: string, departmentId?: number) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.register({ name, email, password, department_id: departmentId });
      set({ user: data.user, token: data.token });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  setUser: (user: User | null) => {
    set({ user });
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        set({ token, user: JSON.parse(user) });
      } catch {
        localStorage.removeItem('user');
      }
    }
  },
}));
