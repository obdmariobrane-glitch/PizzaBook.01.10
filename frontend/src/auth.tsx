// Auth context + API client
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

const storage = {
  async get(key: string) {
    if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, val: string) {
    if (Platform.OS === 'web') { window.localStorage.setItem(key, val); return; }
    return SecureStore.setItemAsync(key, val);
  },
  async del(key: string) {
    if (Platform.OS === 'web') { window.localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

let inMemoryToken: string | null = null;

export function getToken() { return inMemoryToken; }

export async function api(path: string, opts: RequestInit = {}) {
  const headers: any = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (inMemoryToken) headers['Authorization'] = `Bearer ${inMemoryToken}`;
  const res = await fetch(`${BACKEND}${path}`, { ...opts, headers });
  if (res.status === 401) {
    inMemoryToken = null;
    await storage.del('session_token');
  }
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error((json && json.detail) || res.statusText);
  return json;
}

export function fileUrl(path: string) {
  if (path.startsWith('/api/')) return `${BACKEND}${path}`;
  return `${BACKEND}/api/files/${path}`;
}

type User = { user_id: string; email: string; name: string; picture?: string; bio?: string; equipment?: string };
type Ctx = {
  user: User | null; loading: boolean;
  signInWithSessionId: (sid: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<Ctx>({} as any);
export const useAuth = () => useContext(AuthContext);

const processedIds = new Set<string>();
const processingIds = new Set<string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api('/api/me');
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  const signInWithSessionId = useCallback(async (sid: string) => {
    if (processedIds.has(sid) || processingIds.has(sid)) return;
    processingIds.add(sid);
    try {
      const r = await api('/api/auth/session', { method: 'POST', body: JSON.stringify({ session_id: sid }) });
      processedIds.add(sid);
      inMemoryToken = r.session_token;
      await storage.set('session_token', r.session_token);
      setUser(r.user);
    } finally {
      processingIds.delete(sid);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    inMemoryToken = null;
    await storage.del('session_token');
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api('/api/account', { method: 'DELETE' });
    inMemoryToken = null;
    await storage.del('session_token');
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<User>) => {
    const u = await api('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) });
    setUser(u);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await storage.get('session_token');
      if (stored) {
        inMemoryToken = stored;
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithSessionId, logout, deleteAccount, refresh, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
