import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { syncService } from '../services/sync';

interface AppLockContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isLocked, setIsLocked] = useState(true);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has returned to the foreground
        if (lastBackgroundTime.current && isAuthenticated) {
          const elapsedSeconds = (Date.now() - lastBackgroundTime.current) / 1000;
          if (elapsedSeconds > 15) {
            setIsLocked(true);
          }
        }
        // Force sync when returning to foreground (handles internet reconnect)
        syncService.forceSync();
      } else if (nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        lastBackgroundTime.current = Date.now();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  const lock = () => setIsLocked(true);
  const unlock = () => setIsLocked(false);

  return (
    <AppLockContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
}
