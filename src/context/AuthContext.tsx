import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';

import * as db from '../services/db';
import { syncService } from '../services/sync';
import { saveLocalPinHash, clearLocalPinHash } from '../utils/security';

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
    setIsAuthLoading(false);
  };

  const updateUser = async (newUser: any) => {
    try {
      const canonicalUser = newUser?.user || newUser;
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(canonicalUser));
      setUser(canonicalUser);
      if (canonicalUser?.username) {
        await SecureStore.setItemAsync(LAST_LOGGED_IN_USER_KEY, canonicalUser.username);
        setLastLoggedInUser(canonicalUser.username);
      }
    } catch (e) {
      console.warn('Failed to update secure session user:', e);
    }
  };

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
