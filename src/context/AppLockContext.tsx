import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';

interface AppLockContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);

  // Lock on initial load if we have a valid session restored (and we finished initializing)
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      setIsLocked(true);
    }
  }, [isInitializing, isAuthenticated]);

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
