# 🚨 PRIORITY #1: READ THIS FILE FIRST BEFORE ANY OTHER FILE 🚨

# DPT Mobile App — Complete Master Architectural & Technical Blueprint

> **🛑 MANDATORY SYSTEM INSTRUCTION FOR ALL AI SESSIONS & DEVELOPERS**:
> **THIS FILE IS THE SINGLE SOURCE OF TRUTH (SSOT) FOR THE ENTIRE PROJECT.**
> **YOU MUST READ THIS FILE COMPLETELY AT THE VERY BEGINNING OF EVERY WORK SESSION OR UPON RECEIVING ANY TASK.**
> Whenever any changes, new screens, database updates, API endpoints, button flows, or security adjustments are made, **YOU MUST UPDATE THIS `PROJECT_DOCUMENTATION.md` FILE IMMEDIATELY BEFORE ENDING YOUR TURN.**

---

## Table of Contents
1. [Project Identity & Executive Summary](#1-project-identity--executive-summary)
2. [Complete System Environment & Version Rules](#2-complete-system-environment--version-rules)
3. [Exhaustive 100% File & Folder Directory Tree](#3-exhaustive-100-file--folder-directory-tree)
4. [Critical Safety Rules (How NOT to crash the project)](#4-critical-safety-rules-how-not-to-crash-the-project)
5. [Canonical User Data Model (Standardized Schema)](#5-canonical-user-data-model-standardized-schema)
6. [Offline-First SQLite Caching & Database Schema](#6-offline-first-sqlite-caching--database-schema)
7. [SyncService & Background Delta Sync Logic](#7-syncservice--background-delta-sync-logic)
8. [Authentication, Session Restore & Lock Engine](#8-authentication-session-restore--lock-engine)
9. [2-Step Security Protocol (PIN -> Biometrics)](#9-2-step-security-protocol-pin---biometrics)
10. [Multi-Theme Engine (Classic vs Sol Theme & Dark Mode)](#10-multi-theme-engine-classic-vs-sol-theme--dark-mode)
11. [Exhaustive Screen Inventory & Button Action Map (29 Screens)](#11-exhaustive-screen-inventory--button-action-map-29-screens)
12. [Reusable UI Component Inventory & Code Implementation](#12-reusable-ui-component-inventory--code-implementation)
13. [Backend REST API Endpoint Contracts & JSON Payload Examples](#13-backend-rest-api-endpoint-contracts--json-payload-examples)
14. [Source Code Implementations of Core Infrastructure Services](#14-source-code-implementations-of-core-infrastructure-services)
    - [14.1 AuthContext (`src/context/AuthContext.tsx`)](#141-authcontext-srccontextauthcontexttsx)
    - [14.2 ThemeContext (`src/context/ThemeContext.tsx`)](#142-themecontext-srccontextthemecontexttsx)
    - [14.3 Database Service (`src/services/db.ts`)](#143-database-service-srcservicesdbts)
    - [14.4 Sync Service (`src/services/sync.ts`)](#144-sync-service-srcservicessyncts)
    - [14.5 API Service (`src/services/api.ts`)](#145-api-service-srcservicesapits)
    - [14.6 Transaction Mapper (`src/utils/transactionMapper.ts`)](#146-transaction-mapper-srcutilstransactionmapperts)
    - [14.7 Theme Definitions (`src/constants/theme.ts`)](#147-theme-definitions-srcconstantsthemetss)
15. [Developer Commands & Production Build Workflow](#15-developer-commands--production-build-workflow)
16. [Mandatory Update Rules for Future Sessions](#16-mandatory-update-rules-for-future-sessions)

---

## 1. Project Identity & Executive Summary

- **App Name**: DPT (Digital Pocket Transaction)
- **Platform Target**: Android & iOS
- **Architecture**: Offline-First React Native Expo Application with reactive SQLite caching, background REST delta synchronization, SecureStore credential isolation, 2-Step PIN & Biometric security, and dynamic multi-theme engine.

---

## 2. Complete System Environment & Version Rules

- **Expo SDK Version**: **v57.0.0** (Strictly follow `https://docs.expo.dev/versions/v57.0.0/`)
- **React Native Entry Point**: `"main": "index.ts"` in `package.json`
- **Screen Management & Navigation Stack Lifecycle**: Native screen optimizations in `react-native-screens` are disabled via `enableScreens(false)` in `index.ts`. All transaction flows strictly unwind the navigation stack via `router.dismissAll()` on returning to the root Dashboard to prevent screen stacking leaks and Android `ReactClippingViewManager.addView` view collisions.
- **View Recycling Fix**: All transaction form and result ScrollViews explicitly specify `removeClippedSubviews={false}` to prevent Android ViewGroup detachment collisions during rapid sequential transactions.
- **Routing Engine**: Expo Router (File-based routes located strictly in `src/app/`)
- **TypeScript**: Strict Mode enabled (`tsconfig.json` path alias `@/*` maps to `./src/*`)
- **Backend API Base URL**: `https://e-pay-fydp.onrender.com`

---

## 3. Exhaustive 100% File & Folder Directory Tree

```text
/run/media/shaki/2472D89F72D87750/NEW/
├── app.json                                 # Expo SDK 57 configuration & permissions (Camera, Biometrics)
├── package.json                             # Dependencies & entry point ("expo-router/entry")
├── tsconfig.json                            # TypeScript path alias configuration
├── AGENTS.md                                # Highest priority instruction pointing to PROJECT_DOCUMENTATION.md
├── PROJECT_DOCUMENTATION.md                 # THIS MASTER BLUEPRINT
└── src/
    ├── app/                                 # EXPO ROUTER PAGES (29 Screens)
    │   ├── _layout.tsx                      # Root stack, Theme/Lang/Auth providers, Session Lock router
    │   ├── index.tsx                        # Welcome / Onboarding activation landing page
    │   ├── login.tsx                        # Account login form (username & password)
    │   ├── quick-unlock.tsx                 # App Unlock lockscreen (2-Step PIN -> Biometric sequence)
    │   ├── dashboard.tsx                    # Main Home Dashboard (Balance Card, Action Grid, Activity)
    │   ├── history.tsx                      # Transaction History (All/Success/Failed tabs + Day-wise date filtering + CSV export)
    │   ├── notifications.tsx                # Notifications Feed (Read/Unread badge persistence)
    │   ├── profile.tsx                      # User Profile (Limits, Daily spending, Account details)
    │   ├── settings.tsx                     # Settings (Dark Mode toggle, Classic vs Sol Theme picker)
    │   ├── security.tsx                     # Security Settings (PIN change & Biometrics toggle)
    │   ├── send-money.tsx                   # P2P Send Money input form
    │   ├── send-money-confirm.tsx            # Send Money confirmation screen
    │   ├── cashout.tsx                      # Agent Cash Out input form
    │   ├── merchant.tsx                     # Merchant Payment input form
    │   ├── merchant-confirm.tsx             # Merchant Payment confirmation screen
    │   ├── recharge.tsx                     # Mobile Recharge operator input form
    │   ├── recharge-confirm.tsx             # Mobile Recharge confirmation screen
    │   ├── bills.tsx                        # Utility Bill Payment provider selection
    │   ├── bill-confirm.tsx                 # Utility Bill Payment confirmation screen
    │   ├── qr-pay.tsx                       # Camera QR scanner page
    │   ├── qr-amount.tsx                    # QR payment amount input screen
    │   ├── qr-pay-confirm.tsx               # QR payment confirmation screen
    │   ├── my-qr.tsx                        # User personal QR code generator
    │   ├── features.tsx                     # Additional Features overview page
    │   ├── officer-verify.tsx               # Officer activation code verification form
    │   ├── biometric-enrollment.tsx        # Initial biometric registration setup
    │   ├── create-password.tsx              # Account password creation form
    │   ├── activation-success.tsx           # Activation success confirmation page
    │   ├── transaction-processing.tsx       # Async API execution overlay screen
    │   └── transaction-result.tsx           # Detailed Printable Transaction Receipt
    ├── components/                          # REUSABLE COMPONENTS
    │   ├── Header.tsx                       # Dynamic header bar with back chevron
    │   ├── Logo.tsx                         # Official DPT Brand LogoMark (assets/dpt new.png)
    │   └── TransactionAuthScreen.tsx        # 2-Step PIN -> Biometrics transfer authorization modal
    ├── context/                             # STATE PROVIDERS
    │   ├── AuthContext.tsx                  # Tokens, user state, login, logout, switchAccount
    │   ├── ThemeContext.tsx                 # Dynamic Theme Engine (Classic vs Sol, Dark Mode)
    │   ├── LanguageContext.tsx              # Localization Engine (English vs Bangla)
    │   └── AppLockContext.tsx               # Session Lock Manager (`isLocked` state)
    ├── constants/                           # DESIGN TOKENS & STRINGS
    │   ├── theme.ts                         # Color tokens & palettes for Classic and Sol themes
    │   └── translations.ts                  # English & Bangla translation dictionaries
    ├── services/                            # CORE SERVICES
    │   ├── api.ts                           # REST API client endpoints & fetch wrappers
    │   ├── db.ts                            # Expo SQLite database setup, queries & UPSERTs
    │   └── sync.ts                          # SyncService background 15s delta sync manager
    └── utils/                               # UTILITY HELPERS
        ├── transactionMapper.ts            # Maps raw API transactions to normalized UI structures
        └── security.ts                     # Hardware-isolated salted SHA-256 local PIN hashing & verification
```

---

## 4. Critical Safety Rules (How NOT to crash the project)

1. **NEVER Wrap User Objects inside `user.user`**:
   - `user` object in `AuthContext` MUST BE A FLAT OBJECT: `{ id, username, balance, ... }`.
   - Never store `{ user: { username: ... } }` inside state. Always unwrap `userRes.data.user || userRes.data`.

2. **NEVER Invoke `db.saveCachedUser` Inside `AuthContext.updateUser`**:
   - Calling `db.saveCachedUser` triggers `SyncService.notifyListeners()`.
   - If `updateUser()` calls `saveCachedUser()`, it creates an **INFINITE RE-RENDER LOOP** between `updateUser` $\leftrightarrow$ `SyncService` $\leftrightarrow$ `setUser`.
   - Always compare object JSON strings before setting state: `if (JSON.stringify(prev) === JSON.stringify(next)) return prev;`.

3. **ALWAYS Clear Loading States in `finally` Blocks**:
   - In `dashboard.tsx`, `history.tsx`, and `notifications.tsx`, state setters like `setBalanceLoading(false)` and `setTransactionsLoading(false)` MUST BE IN A `finally` BLOCK to prevent perpetual loading spinners.

4. **DO NOT Mutate Private Module Globals**:
   - Always use `useAppTheme()` for colors. Never hardcode colors like `#583EF2` or `#FF6B00` inside screen inline styles.

---

## 5. Canonical User Data Model (Standardized Schema)

All components, context functions, and SQLite helper queries consume the **exact same flat user structure**:

```typescript
export interface CanonicalUser {
  id: number;
  username: string;
  balance: number;
  daily_limit: number;
  today_spent: number;
  account_id?: string;
  phone?: string;
  name?: string;
}
```

---

## 6. Offline-First SQLite Caching & Database Schema

Database Name: `niropay.db` (Managed via `src/services/db.ts`)

### Table 1: `cached_user`
```sql
CREATE TABLE IF NOT EXISTS cached_user (
  username TEXT PRIMARY KEY,
  data TEXT, -- JSON stringified CanonicalUser
  updated_at TEXT
);
```

### Table 2: `cached_transactions`
```sql
CREATE TABLE IF NOT EXISTS cached_transactions (
  id TEXT PRIMARY KEY,
  username TEXT,
  data TEXT, -- JSON stringified Transaction
  created_at TEXT
);
```

### Table 3: `cached_notifications`
```sql
CREATE TABLE IF NOT EXISTS cached_notifications (
  id TEXT PRIMARY KEY,
  username TEXT,
  data TEXT, -- JSON stringified Notification
  created_at TEXT
);
```

---

## 7. SyncService & Background Delta Sync Logic

Located in `src/services/sync.ts`:
- **`initialSync(username)`**: Downloads full dataset upon login and performs initial SQLite UPSERT.
- **`deltaSync(username)`**: Queries SQLite for the latest `created_at` timestamp and passes `?since=<iso_timestamp>` to API endpoints. Only new or updated records are merged into SQLite using `INSERT OR REPLACE INTO`.
- **`startBackgroundSync(username)`**: Runs an automatic 15-second timer (`setInterval`).
- **`subscribe(listener)`**: Emits events to update UI components reactively whenever SQLite changes.

---

## 8. Authentication, Session Restore & Lock Engine

1. **SecureStore Keys**:
   - `niropay_token`: JWT Authorization bearer token.
   - `niropay_user`: JSON string of `CanonicalUser`.
   - `niropay_last_user`: Username string for unlock screen display.
   - `niropay_theme_mode`: Current active theme (`'classic'` | `'sol'`).
   - `niropay_read_notifications_<username>`: JSON array of read notification IDs.

2. **Session Restore Flow (`AuthContext.tsx` & `_layout.tsx`)**:
   - On app startup, `loadSession()` restores `niropay_token` and `niropay_user`.
   - If `isAuthenticated = true`, `_layout.tsx` checks `isLocked`. If locked, redirects to `/quick-unlock`.

---

## 9. 2-Step Security Protocol (PIN -> Biometrics)

Every sensitive action (App Unlock, Send Money, Cash Out, Merchant Payment, Recharge, Bill Payment, QR Payment) MUST enforce the sequential 2-step verification:

```
[ Trigger Action / Transfer ]
             │
             ▼
 Step 1: Input 8-Digit PIN
             │
             ▼
 Local Salted SHA-256 Verification (`verifyPinLocally` via SecureStore, 0ms latency, 100% offline)
             │
             ▼
 Step 2: Device Biometric Scan (`expo-local-authentication`)
             │
             ▼
 Execute API Operation / Grant Access
```

---

## 10. Multi-Theme Engine (Classic vs Sol Theme & Dark Mode)

Centralized in `ThemeContext.tsx` & `src/constants/theme.ts`:

| Token | Classic Theme (Purple) | Sol Theme (Enterprise Orange & Charcoal) |
| :--- | :--- | :--- |
| `theme.primary` | `#583EF2` | `#FF6B00` (Sol Orange) |
| `theme.primaryLight` | `#EBE8FF` | `#FFF0E5` |
| `theme.gradient` | `['#583EF2', '#8F78FF']` | `['#FF6B00', '#FF8533']` |
| `theme.text` | `#0E0D2C` (Light) / `#FFFFFF` (Dark) | `#1C1D21` (Charcoal) / `#F9FAFB` (Dark) |
| `theme.border` | `#E2E0EE` | `#E5E7EB` (Minimal Light Gray) |
| `theme.background` | `#FFFFFF` | `#FFFFFF` |
| `theme.success` | `#09C487` | `#10B981` (Emerald Green) |
| `theme.error` | `#FF3838` | `#EF4444` |

---

## 11. Exhaustive Screen Inventory & Button Action Map (29 Screens)

1. **`index.tsx`**: `[Have Activation Code]` $\rightarrow$ `/officer-verify`, `[Already Registered? Login]` $\rightarrow$ `/login`.
2. **`login.tsx`**: `[Eye Icon]` toggles password, `[Login]` calls `AuthContext.login()` $\rightarrow$ `/dashboard`, `[Activate new account]` $\rightarrow$ `/officer-verify`.
3. **`quick-unlock.tsx`**: PIN Keypad (0-9, Backspace), Fingerprint Circle scan, `[Switch Account]` $\rightarrow$ `/login`, `[Logout]` $\rightarrow$ `/login`.
4. **`dashboard.tsx`**: Eye icon balance toggle, Profile avatar $\rightarrow$ `/profile`, 8 grid feature items, recent activity list, 5 bottom tabs.
5. **`history.tsx`**: Filter tabs (All, Successful, Failed), CSV export icon, card click $\rightarrow$ `/transaction-result`.
6. **`notifications.tsx`**: `[Mark All as Read]` button, item click toggles local read status, deduplicates login notifications to show only the freshest login notification.
7. **`profile.tsx`**: Limits progress bar, `[Security Settings]` $\rightarrow$ `/security`, `[App Settings]` $\rightarrow$ `/settings`, `[Show My QR]` $\rightarrow$ `/my-qr`.
8. **`settings.tsx`**: Dark mode switch, Theme Preset toggle (`Classic` vs `Sol`), language picker modal, currency picker modal.
9. **`security.tsx`**: PIN change form & biometrics toggle switch.
10. **`send-money.tsx` & `send-money-confirm.tsx`**: Recipient check $\rightarrow$ `TransactionAuthScreen` modal (PIN + Biometrics) $\rightarrow$ `/transaction-processing`.
11. **`cashout.tsx`**: Agent cashout form $\rightarrow$ `TransactionAuthScreen` modal $\rightarrow$ `/transaction-processing`.
12. **`merchant.tsx` & `merchant-confirm.tsx`**: Merchant payment form $\rightarrow$ `TransactionAuthScreen` modal.
13. **`recharge.tsx` & `recharge-confirm.tsx`**: Mobile recharge operator selector $\rightarrow$ `TransactionAuthScreen` modal.
14. **`bills.tsx` & `bill-confirm.tsx`**: Utility bill selector $\rightarrow$ `TransactionAuthScreen` modal.
15. **`qr-pay.tsx`, `qr-amount.tsx` & `qr-pay-confirm.tsx`**: Camera QR scanner $\rightarrow$ amount input $\rightarrow$ `TransactionAuthScreen` modal.
16. **`my-qr.tsx`**: Personal account QR display for receiving money.
17. **`features.tsx`**: Additional services promotional showcase.
18. **`officer-verify.tsx`**: Activation code verification form.
19. **`biometric-enrollment.tsx`**: Initial biometric setup guide.
20. **`create-password.tsx`**: Password setup form.
21. **`activation-success.tsx`**: Account activation success confirmation.
22. **`transaction-processing.tsx`**: Async processing loading overlay screen.
23. **`transaction-result.tsx`**: Detailed printable transaction receipt screen.

---

## 12. Reusable UI Component Inventory & Code Implementation

- **`Header.tsx`**: Dynamic header bar with back arrow and title.
- **`Logo.tsx`**: Theme-aware SVG vector ribbon LogoMark reading `theme.gradient`.
- **`TransactionAuthScreen.tsx`**: Modal enforcing 2-step PIN $\rightarrow$ Biometrics sequence before executing money transfers.

---

## 13. Backend REST API Endpoint Contracts & JSON Payload Examples

Base URL: `https://e-pay-fydp.onrender.com`

- **`POST /login`**: Body: `{ username, password }` $\rightarrow$ `{ token, user }`.
- **`GET /user/:username`**: Headers: `Authorization: Bearer <token>` $\rightarrow$ `{ id, username, balance, ... }`.
- **`GET /transactions/:username?since=<timestamp>`**: Returns `{ transactions: [...] }`.
- **`GET /notifications/:username?since=<timestamp>`**: Returns `{ notifications: [...] }`.
- **`GET /check-receiver/:username`**: Returns `{ success: true }`.
- **`POST /transfer`**: Body: `{ username, receiver, amount }` $\rightarrow$ `{ status: "success", reference: "..." }`.

---

## 14. Source Code Implementations of Core Infrastructure Services

### 14.1 AuthContext (`src/context/AuthContext.tsx`)
```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as api from '../services/api';
import * as db from '../services/db';
import { syncService } from '../services/sync';

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

          const sqliteUser = await db.getCachedUser(canonicalUser.username);
          const finalUser = sqliteUser ? (sqliteUser.user || sqliteUser) : canonicalUser;
          setUser(finalUser);

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
      } catch (e) {
        console.warn('Failed to save session to secure store:', e);
      }

      setToken(result.data.token);
      setUser(canonicalUser);
      setLastLoggedInUser(canonicalUser.username);
      setIsAuthLoading(false);

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
```

---

### 14.2 ThemeContext (`src/context/ThemeContext.tsx`)
```typescript
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../constants/theme';

export type ActiveThemeName = 'classic' | 'sol';

const THEME_MODE_KEY = 'niropay_theme_mode';

interface ThemeContextType {
  theme: typeof Colors.classic.light;
  activeThemeName: ActiveThemeName;
  isDarkMode: boolean;
  setThemeName: (name: ActiveThemeName) => Promise<void>;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeName, setActiveThemeNameState] = useState<ActiveThemeName>('classic');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    async function loadThemePreference() {
      try {
        const storedTheme = await SecureStore.getItemAsync(THEME_MODE_KEY);
        if (storedTheme === 'sol' || storedTheme === 'classic') {
          setActiveThemeNameState(storedTheme as ActiveThemeName);
        } else if (storedTheme === 'solshare') {
          setActiveThemeNameState('sol');
          await SecureStore.setItemAsync(THEME_MODE_KEY, 'sol');
        }
      } catch (e) {
        console.warn('Failed to load theme preference from SecureStore:', e);
      }
    }
    loadThemePreference();
  }, []);

  const setThemeName = async (name: ActiveThemeName) => {
    setActiveThemeNameState(name);
    try {
      await SecureStore.setItemAsync(THEME_MODE_KEY, name);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const selectedPalette = Colors[activeThemeName] || Colors.classic;
  const theme = isDarkMode ? selectedPalette.dark : selectedPalette.light;

  return (
    <ThemeContext.Provider
      value={{
        theme: theme as any,
        activeThemeName,
        isDarkMode,
        setThemeName,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
```

---

### 14.3 Database Service (`src/services/db.ts`)
```typescript
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('niropay.db');
    await initDb(dbInstance);
  }
  return dbInstance;
}

async function initDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cached_user (
      username TEXT PRIMARY KEY,
      data TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cached_transactions (
      id TEXT PRIMARY KEY,
      username TEXT,
      data TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cached_notifications (
      id TEXT PRIMARY KEY,
      username TEXT,
      data TEXT,
      created_at TEXT
    );
  `);
}

export async function saveCachedUser(username: string, userData: any): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_user (username, data, updated_at) VALUES (?, ?, ?)`,
    [username, JSON.stringify(userData), now]
  );
}

export async function getCachedUser(username: string): Promise<any | null> {
  const db = await getDb();
  const row: any = await db.getFirstAsync(
    `SELECT data FROM cached_user WHERE username = ?`,
    [username]
  );
  if (row && row.data) {
    try {
      return JSON.parse(row.data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function saveCachedTransactions(username: string, transactions: any[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      const id = String(tx.id || Math.random());
      const createdAt = tx.created_at || tx.timestamp || new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_transactions (id, username, data, created_at) VALUES (?, ?, ?, ?)`,
        [id, username, JSON.stringify(tx), createdAt]
      );
    }
  });
}

export async function getCachedTransactions(username: string): Promise<any[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT data FROM cached_transactions WHERE username = ? ORDER BY created_at DESC`,
    [username]
  );
  return rows.map((r: any) => {
    try {
      return JSON.parse(r.data);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

export async function getLatestCachedTransactionTimestamp(username: string): Promise<string | null> {
  const db = await getDb();
  const row: any = await db.getFirstAsync(
    `SELECT created_at FROM cached_transactions WHERE username = ? ORDER BY created_at DESC LIMIT 1`,
    [username]
  );
  return row ? row.created_at : null;
}

export async function mergeCachedTransactions(username: string, newTransactions: any[]): Promise<void> {
  await saveCachedTransactions(username, newTransactions);
}

export async function saveCachedNotifications(username: string, notifications: any[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const notif of notifications) {
      const id = String(notif.id || Math.random());
      const createdAt = notif.created_at || notif.timestamp || new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_notifications (id, username, data, created_at) VALUES (?, ?, ?, ?)`,
        [id, username, JSON.stringify(notif), createdAt]
      );
    }
  });
}

export async function getCachedNotifications(username: string): Promise<any[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT data FROM cached_notifications WHERE username = ? ORDER BY created_at DESC`,
    [username]
  );
  return rows.map((r: any) => {
    try {
      return JSON.parse(r.data);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

export async function getLatestCachedNotificationTimestamp(username: string): Promise<string | null> {
  const db = await getDb();
  const row: any = await db.getFirstAsync(
    `SELECT created_at FROM cached_notifications WHERE username = ? ORDER BY created_at DESC LIMIT 1`,
    [username]
  );
  return row ? row.created_at : null;
}

export async function mergeCachedNotifications(username: string, newNotifications: any[]): Promise<void> {
  await saveCachedNotifications(username, newNotifications);
}

export async function clearUserCache(username: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM cached_user WHERE username = ?`, [username]);
  await db.runAsync(`DELETE FROM cached_transactions WHERE username = ?`, [username]);
  await db.runAsync(`DELETE FROM cached_notifications WHERE username = ?`, [username]);
}
```

---

### 14.4 Sync Service (`src/services/sync.ts`)
```typescript
import * as api from './api';
import * as db from './db';

type SyncListener = () => void;

class SyncService {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private listeners: Set<SyncListener> = new Set();
  private syncIntervalMs = 15000;

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('[SYNC SERVICE] Error in listener:', err);
      }
    });
  }

  async initialSync(username: string): Promise<void> {
    if (!username) return;

    try {
      const userRes = await api.getUser(username);
      if (userRes.success && userRes.data) {
        await db.saveCachedUser(username, userRes.data);
      }

      const txRes = await api.getTransactions(username);
      if (txRes.success && Array.isArray(txRes.data)) {
        await db.saveCachedTransactions(username, txRes.data);
      }

      const notifRes = await api.getNotifications(username);
      if (notifRes.success && Array.isArray(notifRes.data)) {
        await db.saveCachedNotifications(username, notifRes.data);
      }

      this.notifyListeners();
    } catch (error) {
      console.error('[SYNC SERVICE] Exception during initialSync:', error);
    }
  }

  async deltaSync(username: string): Promise<void> {
    if (!username || this.isSyncing) return;

    this.isSyncing = true;
    let hasChanges = false;

    try {
      const userRes = await api.getUser(username);
      if (userRes.success && userRes.data) {
        await db.saveCachedUser(username, userRes.data);
        hasChanges = true;
      }

      const latestTxTime = await db.getLatestCachedTransactionTimestamp(username);
      const txRes = await api.getTransactions(username, latestTxTime || undefined);
      if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
        await db.mergeCachedTransactions(username, txRes.data);
        hasChanges = true;
      }

      const latestNotifTime = await db.getLatestCachedNotificationTimestamp(username);
      const notifRes = await api.getNotifications(username, latestNotifTime || undefined);
      if (notifRes.success && Array.isArray(notifRes.data) && notifRes.data.length > 0) {
        await db.mergeCachedNotifications(username, notifRes.data);
        hasChanges = true;
      }

      if (hasChanges) {
        this.notifyListeners();
      }
    } catch (error) {
      console.error('[SYNC SERVICE] Exception during deltaSync:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  startBackgroundSync(username: string): void {
    this.stopBackgroundSync();
    if (!username) return;

    this.deltaSync(username);

    this.syncTimer = setInterval(() => {
      this.deltaSync(username);
    }, this.syncIntervalMs);
  }

  stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isSyncing = false;
  }
}

export const syncService = new SyncService();
```

---

### 14.5 API Service (`src/services/api.ts`)
```typescript
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://e-pay-fydp.onrender.com';
const TOKEN_KEY = 'niropay_token';
const USER_KEY = 'niropay_user';

async function getHeaders(authRequired = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authRequired) {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

export interface ApiResult<T> {
  success: boolean;
  message?: string;
  data?: T;
  status?: number;
}

export async function login(username: string, password: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: await getHeaders(false),
      body: JSON.stringify({ username, password }),
    });

    const json = await response.json();

    if (response.ok) {
      const token = json.token;
      const user = json.user || {
        id: json.id,
        username: json.username || username,
        t: json.t,
        balance: json.balance,
        accountId: json.accountId || json.account_id,
        daily_limit: json.daily_limit || json.dailyLimit,
        today_spent: json.today_spent || json.todaySpent,
      };

      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

      return { success: true, data: { token, user } };
    } else {
      let message = json.error || json.message || 'Authentication failed';
      if (response.status === 400) message = json.error || 'Missing username or password';
      if (response.status === 401) message = json.error || 'Invalid password';
      if (response.status === 404) message = json.error || 'User not found';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

export async function getUser(username: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/user/${username}`, {
      method: 'GET',
      headers: await getHeaders(true),
    });
    const json = await response.json();
    if (response.ok) {
      return { success: true, data: json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch user info', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

export async function getTransactions(username: string, sinceTimestamp?: string): Promise<ApiResult<any>> {
  try {
    let url = `${BASE_URL}/transactions/${username}`;
    if (sinceTimestamp) {
      url += `?since=${encodeURIComponent(sinceTimestamp)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: await getHeaders(true),
    });
    const json = await response.json();
    if (response.ok) {
      return { success: true, data: json.transactions || json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch transactions', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

export async function getNotifications(username: string, sinceTimestamp?: string): Promise<ApiResult<any>> {
  try {
    let url = `${BASE_URL}/notifications/${username}`;
    if (sinceTimestamp) {
      url += `?since=${encodeURIComponent(sinceTimestamp)}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: await getHeaders(true),
    });
    const json = await response.json();
    if (response.ok) {
      return { success: true, data: json.notifications || json };
    } else {
      return { success: false, message: json.error || json.message || 'Failed to fetch notifications', status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

export async function transfer(username: string, receiver: string, amount: number): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/transfer`, {
      method: 'POST',
      headers: await getHeaders(true),
      body: JSON.stringify({ username, receiver, amount }),
    });
    const json = await response.json();
    if (response.ok) {
      if (json.status === 'futile' || json.status === 'failed') {
        return { success: false, message: json.message || 'Transaction failed', status: 200 };
      }
      return { success: true, data: json };
    } else {
      let message = json.error || json.message || 'Transfer failed';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}

export async function verifyPin(username: string, pin: string): Promise<ApiResult<any>> {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pin }),
    });
    const json = await response.json();
    if (response.ok) {
      return { success: true, data: json };
    } else {
      let message = json.error || json.message || 'Verification failed';
      if (response.status === 401) message = 'Invalid PIN';
      return { success: false, message, status: response.status };
    }
  } catch (error: any) {
    return { success: false, message: error.message || 'Network connection failed' };
  }
}
```

---

### 14.6 Transaction Mapper (`src/utils/transactionMapper.ts`)
```typescript
export interface MappedTransaction {
  id: string;
  title: string;
  time: string;
  amount: string;
  amountVal: number;
  isOutgoing: boolean;
  status: string;
  statusEnglish: 'Successful' | 'Failed';
  rawStatus: string;
  referenceNo: string;
  errorCode?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  receiver: string;
}

export function mapApiTransaction(
  tx: any,
  currentUsername: string,
  t: any,
  language: 'en' | 'bn',
  theme?: any
): MappedTransaction {
  const primaryColor = theme?.primary || '#583EF2';
  const primaryLightColor = theme?.primaryLight || '#EBE8FF';
  const successColor = theme?.success || '#09C487';
  const errorColor = theme?.error || '#FF3838';

  const sender = (tx.sender_username || tx.sender || '').toLowerCase();
  const receiver = (tx.receiver_username || tx.receiver || '').toLowerCase();

  let isOutgoing = false;
  const typeLower = tx.type?.toLowerCase() || '';

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money') {
    isOutgoing = true;
  } else if (typeLower === 'received' || typeLower === 'receive') {
    isOutgoing = false;
  } else if (currentUsername) {
    if (sender === currentUsername) {
      isOutgoing = true;
    } else if (receiver === currentUsername) {
      isOutgoing = false;
    } else {
      isOutgoing = !!sender;
    }
  }

  const counterpart = isOutgoing ? (tx.receiver_username || tx.receiver) : (tx.sender_username || tx.sender);
  const displayCounterpart = counterpart
    ? (counterpart.charAt(0).toUpperCase() + counterpart.slice(1))
    : 'N/A';

  let iconName = 'swap-horizontal-outline';
  let iconBg = primaryLightColor;
  let iconColor = primaryColor;
  let displayTitle = '';

  if (typeLower === 'sent' || typeLower === 'send' || typeLower === 'send_money' || typeLower === 'received' || typeLower === 'receive') {
    iconName = isOutgoing ? 'send-outline' : 'arrow-down-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `${t.sendMoney || 'Send Money'} to ${displayCounterpart}`
      : `${language === 'en' ? 'Receive Money' : 'টাকা গ্রহণ'} from ${displayCounterpart}`;
  } else if (typeLower === 'recharge' || typeLower === 'mobile_recharge') {
    iconName = 'flash-outline';
    iconBg = '#FFF9E6';
    iconColor = '#FF9500';
    displayTitle = `${t.mobileRecharge || 'Mobile Recharge'} (${tx.operator || tx.mobileNumber || ''})`;
  } else if (typeLower === 'bill' || typeLower === 'bill_payment') {
    iconName = 'document-text-outline';
    iconBg = 'rgba(239, 68, 68, 0.12)';
    iconColor = errorColor;
    displayTitle = `${t.billPayment || 'Bill Payment'} (${tx.billerName || ''})`;
  } else {
    iconName = isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
    iconBg = isOutgoing ? primaryLightColor : 'rgba(16, 185, 129, 0.12)';
    iconColor = isOutgoing ? primaryColor : successColor;
    displayTitle = isOutgoing
      ? `Payment to ${displayCounterpart}`
      : `Payment from ${displayCounterpart}`;
  }

  let formattedTime = tx.created_at || tx.timestamp || 'N/A';
  if (formattedTime !== 'N/A') {
    try {
      const cleanStr = String(formattedTime).replace('Z', '+00:00');
      const dt = new Date(cleanStr);
      if (!isNaN(dt.getTime())) {
        const day = String(dt.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[dt.getMonth()];
        const year = dt.getFullYear();
        let hours = dt.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const strHours = String(hours).padStart(2, '0');
        const minutes = String(dt.getMinutes()).padStart(2, '0');
        formattedTime = `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
      }
    } catch (e) {}
  }

  const isTxSuccess = tx.status === 'success' || tx.status === 'Successful';
  const amountVal = parseFloat(tx.amount || 0);

  return {
    id: String(tx.id || Math.random()),
    title: displayTitle,
    time: formattedTime,
    amount: `${isOutgoing ? '-' : '+'} ৳${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    amountVal,
    isOutgoing,
    status: isTxSuccess
      ? (language === 'en' ? 'Successful' : 'সফল')
      : (language === 'en' ? 'Failed' : 'ব্যর্থ'),
    statusEnglish: isTxSuccess ? 'Successful' : 'Failed',
    rawStatus: tx.status,
    referenceNo: tx.reference || tx.referenceNo || 'N/A',
    errorCode: tx.failure_reason || tx.errorCode,
    icon: iconName,
    iconColor,
    iconBg,
    receiver: displayCounterpart,
  };
}
```

---

### 14.7 Theme Definitions (`src/constants/theme.ts`)
```typescript
import { Platform } from 'react-native';

export const Colors = {
  primary: '#583EF2',
  primaryLight: '#EBE8FF',
  textDark: '#0E0D2C',
  textGrey: '#7E7C9D',
  background: '#FFFFFF',
  success: '#09C487',
  error: '#FF3838',
  white: '#FFFFFF',
  lightGray: '#F4F3F8',
  border: '#E2E0EE',
  cardBg: '#FFFFFF',

  classic: {
    light: {
      primary: '#583EF2',
      primaryLight: '#EBE8FF',
      gradient: ['#583EF2', '#8F78FF'] as const,
      text: '#0E0D2C',
      textSecondary: '#7E7C9D',
      background: '#FFFFFF',
      backgroundElement: '#F4F3F8',
      backgroundSelected: '#EBE8FF',
      success: '#09C487',
      error: '#FF3838',
      border: '#E2E0EE',
      cardBg: '#FFFFFF',
      textDark: '#0E0D2C',
    },
    dark: {
      primary: '#583EF2',
      primaryLight: '#2C2754',
      gradient: ['#583EF2', '#8F78FF'] as const,
      text: '#FFFFFF',
      textSecondary: '#A5A3C1',
      background: '#121212',
      backgroundElement: '#1E1E1E',
      backgroundSelected: '#2C2754',
      success: '#09C487',
      error: '#FF3838',
      border: '#2A2A2A',
      cardBg: '#1E1E1E',
      textDark: '#FFFFFF',
    },
  },

  sol: {
    light: {
      primary: '#FF6B00',
      primaryLight: '#FFF0E5',
      gradient: ['#FF6B00', '#FF8533'] as const,
      text: '#1C1D21',
      textSecondary: '#666970',
      background: '#FFFFFF',
      backgroundElement: '#F7F7F8',
      backgroundSelected: '#FFF0E5',
      success: '#10B981',
      error: '#EF4444',
      border: '#E5E7EB',
      cardBg: '#FFFFFF',
      textDark: '#1C1D21',
    },
    dark: {
      primary: '#FF6B00',
      primaryLight: '#3D1C05',
      gradient: ['#FF6B00', '#FF8533'] as const,
      text: '#F9FAFB',
      textSecondary: '#9CA3AF',
      background: '#111215',
      backgroundElement: '#1A1B20',
      backgroundSelected: '#3D1C05',
      success: '#10B981',
      error: '#EF4444',
      border: '#2B2D35',
      cardBg: '#1A1B20',
      textDark: '#F9FAFB',
    },
  },

  light: {
    primary: '#583EF2',
    primaryLight: '#EBE8FF',
    text: '#0E0D2C',
    textSecondary: '#7E7C9D',
    background: '#FFFFFF',
    backgroundElement: '#F4F3F8',
    backgroundSelected: '#EBE8FF',
    success: '#09C487',
    error: '#FF3838',
    border: '#E2E0EE',
    cardBg: '#FFFFFF',
    textDark: '#0E0D2C',
  },
  dark: {
    primary: '#583EF2',
    primaryLight: '#2C2754',
    text: '#FFFFFF',
    textSecondary: '#A5A3C1',
    background: '#121212',
    backgroundElement: '#1E1E1E',
    backgroundSelected: '#2C2754',
    success: '#09C487',
    error: '#FF3838',
    border: '#2A2A2A',
    cardBg: '#1E1E1E',
    textDark: '#FFFFFF',
  }
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const MaxContentWidth = 800;
```

---

## 15. Developer Commands & Production Build Workflow

### 1. Static Type Safety Check
```bash
npx tsc --noEmit
```

### 2. Local Metro Server Start
```bash
npx expo start
```

### 3. Metro Production Bundle Export
```bash
npx expo export
```

### 4. Build Standalone Local APK Preview
```bash
eas build -p android --profile preview --local
```

---

## 16. Mandatory Update Rules for Future Sessions

> 🛑 **MANDATORY INSTRUCTION FOR ALL DEVELOPERS AND AI ASSISTANTS**:
> 
> Before completing any user request or ending any session turn in this codebase, **you MUST update this `PROJECT_DOCUMENTATION.md` file** if any of the following changes occurred:
> - Added or modified screens in `src/app/`
> - Added or modified button flows or navigation routes
> - Updated database schemas or queries in `src/services/db.ts`
> - Added or modified API endpoints in `src/services/api.ts`
> - Changed design tokens or color palettes in `src/constants/theme.ts`
> - Updated security rules or authentication flows
> 
> **Never leave this documentation out of sync with the actual source code.**
