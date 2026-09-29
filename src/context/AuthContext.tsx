import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';

import * as db from '../services/db';
import { syncService } from '../services/sync';
import { saveLocalPinHash, clearLocalPinHash, DURESS_LIMIT_DEFAULT } from '../utils/security';

const TOKEN_KEY = 'niropay_token';
const USER_KEY = 'niropay_user';
const LAST_LOGGED_IN_USER_KEY = 'niropay_last_user';

interface AuthContextType {
  token: string | null;
  user: any | null;
  lastLoggedInUser: string | null;
  isInitializing: boolean;
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /** True when the session was unlocked with the duress PIN (paper §3.1). */
  isDuressMode: boolean;
  setDuressMode: (v: boolean) => void;
  /** Decoy wallet balance shown in duress mode (0..L_D), persists across duress unlocks. */
  duressBalance: number;
  initDuressBalance: (realBalance: any) => Promise<void>;
  adjustDuressBalance: (delta: number) => void;
  /** Clear the decoy balance (called on a normal-PIN unlock so duress re-initialises). */
  resetDuressBalance: () => void;
  login: (username: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<void>;
  updateUser: (newUser: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [lastLoggedInUser, setLastLoggedInUser] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDuressMode, setIsDuressMode] = useState(false);
  const [duressBalance, setDuressBalance] = useState(0);

  // Duress "decoy" wallet. Persisted per user so it stays IDENTICAL across duress
  // unlocks; it only re-initialises to min(real balance, L_D) after a normal-PIN
  // unlock (which clears the stored value).
  const duressBalKey = (u?: string | null) => `niropay_duress_balance_${u || ''}`;

  const initDuressBalance = async (realBalance: any) => {
    const username = user?.username;
    if (username) {
      try {
        const saved = await SecureStore.getItemAsync(duressBalKey(username));
        if (saved !== null && saved !== undefined && saved !== '') {
          setDuressBalance(Number(saved) || 0);
          return;
        }
      } catch {}
    }
    // Random decoy amount within 0..min(real balance, L_D). It stays FIXED across
    // duress unlocks until the real PIN is used (which resets it), and decreases
    // whenever a transaction happens while in duress mode.
    const cap = Math.min(Number(realBalance || 0), DURESS_LIMIT_DEFAULT);
    const v = Math.floor(Math.random() * (cap + 1));
    setDuressBalance(v);
    if (username) {
      SecureStore.setItemAsync(duressBalKey(username), String(v)).catch(() => {});
    }
  };

  const adjustDuressBalance = (delta: number) => {
    const username = user?.username;
    setDuressBalance((b) => {
      const next = Math.min(DURESS_LIMIT_DEFAULT, Math.max(0, b + delta));
      if (username) {
        SecureStore.setItemAsync(duressBalKey(username), String(next)).catch(() => {});
      }
      return next;
    });
  };

  const resetDuressBalance = () => {
    setDuressBalance(0);
    const username = user?.username;
    if (username) {
      SecureStore.deleteItemAsync(duressBalKey(username)).catch(() => {});
    }
  };

  // Load session from SecureStore on mount & read SQLite cache
  useEffect(() => {
    async function loadSession() {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        const storedLastUser = await SecureStore.getItemAsync(LAST_LOGGED_IN_USER_KEY);
        
        if (storedLastUser) {
          setLastLoggedInUser(storedLastUser);
        }

        if (storedToken && storedUser) {
          const rawParsed = JSON.parse(storedUser);
          const canonicalUser = rawParsed.user || rawParsed;
          setToken(storedToken);

          // Read cached user profile from SQLite first (offline-first)
          const sqliteUser = await db.getCachedUser(canonicalUser.username);
          const finalUser = sqliteUser ? (sqliteUser.user || sqliteUser) : canonicalUser;
          setUser(finalUser);

          // Start background sync service
          syncService.startBackgroundSync(canonicalUser.username);
        }
      } catch (e) {
        console.warn('Failed to load auth session:', e);
      } finally {
        setIsInitializing(false);
      }
    }
    loadSession();
  }, []);

  // Subscribe to SyncService notifications for SQLite cache updates
  useEffect(() => {
    const username = user?.username || lastLoggedInUser;
    if (!username) return;

    const unsubscribe = syncService.subscribe(async () => {
      const updatedUser = await db.getCachedUser(username);
      if (updatedUser) {
        const canonicalUser = updatedUser.user || updatedUser;
        setUser((prevUser: any) => {
          if (JSON.stringify(prevUser) === JSON.stringify(canonicalUser)) return prevUser;
          return canonicalUser;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.username, lastLoggedInUser]);

  const login = async (username: string, pin: string) => {
    setIsAuthLoading(true);
    const result = await api.login(username, pin);

    if (result.success && result.data) {
      const rawUser = result.data.user || result.data;
      const canonicalUser = rawUser.user || rawUser;

      try {
        await SecureStore.setItemAsync(TOKEN_KEY, result.data.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(canonicalUser));
        await SecureStore.setItemAsync(LAST_LOGGED_IN_USER_KEY, canonicalUser.username);
        await saveLocalPinHash(canonicalUser.username, pin);
      } catch (e) {
        console.warn('Failed to save session to secure store:', e);
      }

      setToken(result.data.token);
      setUser(canonicalUser);
      setLastLoggedInUser(canonicalUser.username);
      setIsDuressMode(false);
      setIsAuthLoading(false);

      // Trigger initial data sync & start background sync service
      syncService.initialSync(canonicalUser.username);
      syncService.startBackgroundSync(canonicalUser.username);

      return { success: true };
    } else {
      setIsAuthLoading(false);
      return { success: false, message: result.message };
    }
  };

  const logout = async () => {
    setIsAuthLoading(true);
    syncService.stopBackgroundSync();
    if (user?.username) {
      await db.clearUserCache(user.username);
      await clearLocalPinHash(user.username);
    }
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(LAST_LOGGED_IN_USER_KEY);
    } catch (e) {
      console.warn('Failed to clear secure session:', e);
    }
    setToken(null);
    setUser(null);
    setLastLoggedInUser(null);
    setIsDuressMode(false);
    setIsAuthLoading(false);
  };

  const switchAccount = async () => {
    setIsAuthLoading(true);
    syncService.stopBackgroundSync();
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {
      console.warn('Failed to clear session token for switch account:', e);
    }
    setToken(null);
    setUser(null);
    setIsDuressMode(false);
    setIsAuthLoading(false);
  };

  const updateUser = React.useCallback(async (newUser: any) => {
    try {
      const canonicalUser = newUser?.user || newUser;
      // Guard: skip if user data is identical (prevents unnecessary re-renders and
      // double-deduction when the dashboard's sync subscriber fires with the same
      // server balance that was already applied as an optimistic local deduction).
      setUser((prev: any) => {
        const prevJson = prev ? JSON.stringify(prev) : '';
        const nextJson = canonicalUser ? JSON.stringify(canonicalUser) : '';
        if (prevJson === nextJson) return prev; // no-op, same reference returned
        // Persist asynchronously outside the reducer
        SecureStore.setItemAsync(USER_KEY, nextJson).catch((e) =>
          console.warn('Failed to persist user to SecureStore:', e)
        );
        if (canonicalUser?.username) {
          SecureStore.setItemAsync(LAST_LOGGED_IN_USER_KEY, canonicalUser.username).catch(() => {});
          setLastLoggedInUser(canonicalUser.username);
        }
        return canonicalUser;
      });
    } catch (e) {
      console.warn('Failed to update secure session user:', e);
    }
  }, []);

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        lastLoggedInUser,
        isInitializing,
        isAuthLoading,
        isAuthenticated,
        isDuressMode,
        setDuressMode: setIsDuressMode,
        duressBalance,
        initDuressBalance,
        adjustDuressBalance,
        resetDuressBalance,
        login,
        logout,
        switchAccount,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
