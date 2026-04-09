'use client';

import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      localStorage.setItem('rv2class_token', token);
      localStorage.setItem('rv2class_user', JSON.stringify(user));

      set({ user, token, isLoading: false, error: null });
    } catch (err: any) {
      const message = err.response?.data?.error || 'Ошибка входа';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('rv2class_token');
    localStorage.removeItem('rv2class_user');
    set({ user: null, token: null });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('rv2class_token');
    const userStr = localStorage.getItem('rv2class_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
      } catch {
        localStorage.removeItem('rv2class_token');
        localStorage.removeItem('rv2class_user');
      }
    }
  },
}));
