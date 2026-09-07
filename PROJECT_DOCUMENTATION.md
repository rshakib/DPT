# 🚨 PRIORITY #1: READ THIS FILE FIRST BEFORE ANY OTHER FILE 🚨

# DPT Mobile App — Complete Master Architectural & Technical Blueprint

> **🛑 MANDATORY SYSTEM INSTRUCTION FOR ALL AI SESSIONS & DEVELOPERS**:
> **THIS FILE IS THE SINGLE SOURCE OF TRUTH (SSOT) FOR THE ENTIRE PROJECT.**
> **YOU MUST READ THIS FILE COMPLETELY AT THE VERY BEGINNING OF EVERY WORK SESSION OR UPON RECEIVING ANY TASK.**
> Whenever any changes, new screens, database updates, API endpoints, button flows, or security adjustments are made, **YOU MUST UPDATE THIS `PROJECT_DOCUMENTATION.md` FILE IMMEDIATELY BEFORE ENDING YOUR TURN.**

---

## Table of Contents
- [🚨 PRIORITY #1: READ THIS FILE FIRST BEFORE ANY OTHER FILE 🚨](#-priority-1-read-this-file-first-before-any-other-file-)
- [DPT Mobile App — Complete Master Architectural \& Technical Blueprint](#dpt-mobile-app--complete-master-architectural--technical-blueprint)
  - [Table of Contents](#table-of-contents)
  - [1. Project Identity \& Executive Summary](#1-project-identity--executive-summary)
  - [2. Complete System Environment \& Version Rules](#2-complete-system-environment--version-rules)
  - [3. Exhaustive 100% File \& Folder Directory Tree](#3-exhaustive-100-file--folder-directory-tree)
  - [4. Critical Safety Rules (How NOT to crash the project)](#4-critical-safety-rules-how-not-to-crash-the-project)
  - [5. Canonical User Data Model (Standardized Schema)](#5-canonical-user-data-model-standardized-schema)
  - [6. Offline-First SQLite Caching \& Database Schema](#6-offline-first-sqlite-caching--database-schema)
    - [Table 1: `cached_user`](#table-1-cached_user)
    - [Table 2: `cached_transactions`](#table-2-cached_transactions)
    - [Table 3: `cached_notifications`](#table-3-cached_notifications)
  - [7. SyncService \& Background Delta Sync Logic](#7-syncservice--background-delta-sync-logic)
  - [8. Authentication, Session Restore \& Lock Engine](#8-authentication-session-restore--lock-engine)
  - [9. 2-Step Security Protocol (PIN -\> Biometrics)](#9-2-step-security-protocol-pin---biometrics)
  - [10. Multi-Theme Engine (Classic vs Sol Theme \& Dark Mode)](#10-multi-theme-engine-classic-vs-sol-theme--dark-mode)
  - [11. Exhaustive Screen Inventory \& Button Action Map (31 Screens)](#11-exhaustive-screen-inventory--button-action-map-31-screens)
  - [12. Reusable UI Component Inventory \& Code Implementation](#12-reusable-ui-component-inventory--code-implementation)
  - [13. Backend REST API Endpoint Contracts \& JSON Payload Examples](#13-backend-rest-api-endpoint-contracts--json-payload-examples)
  - [14. Source Code Implementations of Core Infrastructure Services](#14-source-code-implementations-of-core-infrastructure-services)
    - [14.1 AuthContext (`src/context/AuthContext.tsx`)](#141-authcontext-srccontextauthcontexttsx)
    - [14.2 ThemeContext (`src/context/ThemeContext.tsx`)](#142-themecontext-srccontextthemecontexttsx)
    - [14.3 Database Service (`src/services/db.ts`)](#143-database-service-srcservicesdbts)
    - [14.4 Sync Service (`src/services/sync.ts`)](#144-sync-service-srcservicessyncts)
    - [14.5 API Service (`src/services/api.ts`)](#145-api-service-srcservicesapits)
    - [14.6 Transaction Mapper (`src/utils/transactionMapper.ts`)](#146-transaction-mapper-srcutilstransactionmapperts)
    - [14.7 Theme Definitions (`src/constants/theme.ts`)](#147-theme-definitions-srcconstantsthemets)
  - [15. Developer Commands \& Production Build Workflow](#15-developer-commands--production-build-workflow)
    - [1. Static Type Safety Check](#1-static-type-safety-check)
    - [2. Local Metro Server Start](#2-local-metro-server-start)
    - [3. Metro Production Bundle Export](#3-metro-production-bundle-export)
    - [4. Build Standalone Local APK Preview](#4-build-standalone-local-apk-preview)
  - [16. Mandatory Update Rules for Future Sessions](#16-mandatory-update-rules-for-future-sessions)
  - [17. Comprehensive Forensic Bug Fixes \& Architectural Hardening (DPT Changelog)](#17-comprehensive-forensic-bug-fixes--architectural-hardening-dpt-changelog)
    - [17.1 The Android Native View Collision Crash (`addViewAt...child already has a parent`)](#171-the-android-native-view-collision-crash-addviewatchild-already-has-a-parent)
      - [A. Root Cause Analysis](#a-root-cause-analysis)
      - [B. Architectural Resolution](#b-architectural-resolution)
    - [17.2 Merchant Payment, Mobile Recharge \& Utility Service Payment Handling](#172-merchant-payment-mobile-recharge--utility-service-payment-handling)
      - [A. Root Cause of 404 Rejections on Services](#a-root-cause-of-404-rejections-on-services)
      - [B. Frontend Service Transaction Handling](#b-frontend-service-transaction-handling)
    - [17.3 Concurrency \& Duplicate Navigation Guards](#173-concurrency--duplicate-navigation-guards)
    - [17.4 Brand Asset Migration \& UI Refinements](#174-brand-asset-migration--ui-refinements)
    - [17.5 Offline-First Transaction System (Complete Implementation)](#175-offline-first-transaction-system-complete-implementation)
    - [17.6 UI Redesigns](#176-ui-redesigns)
    - [17.7 New Features](#177-new-features)
    - [17.8 Bug Fixes](#178-bug-fixes)
    - [17.9 Dependencies Added](#179-dependencies-added)

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
/run/media/shaki/2472D89F72D87750/FYDP/
├── index.ts                                 # App entry point: enableScreens(false) + expo-router/entry import
├── App.tsx                                  # Legacy root component (unused — expo-router handles entry via index.ts)
├── app.json                                 # Expo SDK 57 configuration & permissions (Camera, Biometrics)
├── package.json                             # Dependencies & scripts
├── tsconfig.json                            # TypeScript strict mode, path aliases (@/* -> ./src/*)
├── metro.config.js                          # Metro bundler config (adds .wasm asset extension)
├── eas.json                                 # EAS Build profiles (development, preview, production)
├── expo-env.d.ts                            # Expo TypeScript environment declaration
├── .gitignore                               # Ignores node_modules, .expo, dist, ios/, android/
├── AGENTS.md                                # Highest priority instruction pointing to PROJECT_DOCUMENTATION.md
├── PROJECT_DOCUMENTATION.md                 # THIS MASTER BLUEPRINT
├── LICENSE                                  # Project license file
├── OFFLINE_PLAN.md                          # Offline-first architecture planning document
├── REGISTRATION_PIN_FIX_REPORT.md           # PIN registration bug fix report
├── DPT_BIOMETRIC_ENROLLMENT_AUDIT.md       # Biometric enrollment audit
├── DPT_CONFERENCE_SECURITY_ATTACK_ASSESSMENT.md
├── DPT_CONFERENCE_SECURITY_EVIDENCE.md
├── DPT_NEW_ACCOUNT_FLOW_AUDIT.md
├── DPT_NEW_ACCOUNT_PAGE_FLOW_AUDIT.md
├── DPT_REGISTER_400_ROOT_CAUSE_AUDIT.md
├── DPT_REGISTRATION_DEEP_RUNTIME_AUDIT.md
├── DPT_REPLAY_ATTACK_FIX_REPORT.md
├── DPT_SECURITY_ASSESSMENT_REPORT.md
├── crash_log.txt                            # Android crash log for debugging
├── assets/                                  # Static assets (images, fonts, splash, icons)
│   └── images/                              # App illustrations and brand icons
├── android/                                 # Generated native Android project (gitignored)
├── ios/                                     # Generated native iOS project (gitignored)
└── src/
    ├── global.css                           # Global CSS (web platform only)
    ├── app/                                 # EXPO ROUTER PAGES (31 Screens)
    │   ├── _layout.tsx                      # Root stack, Theme/Lang/Auth/AppLock providers, Session Lock router, Sentry stub
    │   ├── index.tsx                        # Welcome / Onboarding activation landing page
    │   ├── login.tsx                        # Account login form (username & 8-digit PIN)
    │   ├── quick-unlock.tsx                 # App Unlock lockscreen (2-Step PIN -> Biometric sequence, 3-strike lockout)
    │   ├── dashboard.tsx                    # Main Home Dashboard (Balance Card, 8-Grid Features, Recent Activity, 5-Tab Bar)
    │   ├── history.tsx                      # Transaction History (All/Success/Failed tabs + Day-wise date filtering + CSV export)
    │   ├── notifications.tsx                # Notifications Feed (Read/Unread badge persistence, login dedup)
    │   ├── profile.tsx                      # User Profile (Menu cards, Security/Settings links, Logout)
    │   ├── settings.tsx                     # Settings (Dark Mode toggle, Classic vs Sol Theme picker, Language/Currency pickers)
    │   ├── security.tsx                     # Security Center (Security score gauge, PIN change, Biometric toggles)
    │   ├── send-money.tsx                   # P2P Send Money input form (live receiver validation, offline mode)
    │   ├── send-money-confirm.tsx           # Send Money 2-Step Auth -> TransactionProcessingView
    │   ├── cashout.tsx                      # Agent Cash Out unavailable placeholder screen
    │   ├── merchant.tsx                     # Merchant Payment input form (popular merchants, custom handles)
    │   ├── merchant-confirm.tsx             # Merchant Payment 2-Step Auth -> TransactionProcessingView
    │   ├── recharge.tsx                     # Mobile Recharge operator selector + amount presets
    │   ├── recharge-confirm.tsx             # Mobile Recharge 2-Step Auth -> TransactionProcessingView
    │   ├── bills.tsx                        # Utility Bill Payment (pending/history tabs, mock billers)
    │   ├── bill-confirm.tsx                 # Utility Bill 2-Step Auth -> TransactionProcessingView
    │   ├── qr-pay.tsx                       # Camera QR scanner + manual username entry fallback
    │   ├── qr-amount.tsx                    # QR payment amount input (quick presets, optional note)
    │   ├── qr-pay-confirm.tsx               # QR payment 2-Step Auth -> transaction-processing route
    │   ├── my-qr.tsx                        # User personal QR code generator (download, share)
    │   ├── features.tsx                     # Additional Features accordion (Email, QR, NFC, Card)
    │   ├── officer-verify.tsx               # Officer activation code verification (NID, Code, Username)
    │   ├── enter-name.tsx                   # Full name input for new account registration
    │   ├── biometric-enrollment.tsx         # Initial biometric setup (fingerprint SVG ring, hardware check)
    │   ├── create-password.tsx              # 8-digit PIN creation form with live strength checklist
    │   ├── activation-success.tsx           # Account activation success page (confetti, features list)
    │   ├── transaction-processing.tsx       # Legacy async API execution overlay screen (being replaced by TransactionProcessingView)
    │   └── transaction-result.tsx           # Detailed Printable Transaction Receipt (copy ref, service-type routing)
    ├── components/                          # REUSABLE COMPONENTS
    │   ├── Header.tsx                       # Dynamic header bar with back chevron and optional title
    │   ├── Logo.tsx                         # Official DPT Brand LogoMark (theme-aware SVG)
    │   ├── TransactionAuthScreen.tsx        # 2-Step PIN -> Biometrics transfer authorization modal
    │   ├── TransactionProcessingView.tsx    # Transaction execution view (API call, offline queue, service fallback)
    │   ├── BottomSkylineSvg.tsx             # City skyline SVG footer illustration (brand color tinted)
    │   └── ui/                              # UI primitives directory (currently empty)
    ├── context/                             # STATE PROVIDERS
    │   ├── AuthContext.tsx                  # Tokens, user state, login, logout, switchAccount, updateUser
    │   ├── ThemeContext.tsx                 # Dynamic Theme Engine (Classic vs Sol, Dark Mode, SecureStore persistence)
    │   ├── LanguageContext.tsx              # Localization Engine (English vs Bangla)
    │   └── AppLockContext.tsx               # Session Lock Manager (auto-lock on 15s background, isLocked state)
    ├── constants/                           # DESIGN TOKENS & STRINGS
    │   ├── theme.ts                         # Color tokens & palettes for Classic, Sol, light/dark modes + Spacing
    │   └── translations.ts                  # English & Bangla translation dictionaries (100+ keys)
    ├── hooks/                               # CUSTOM HOOKS
    │   ├── use-color-scheme.ts              # Native color scheme hook
    │   ├── use-color-scheme.web.ts          # Web color scheme hook
    │   └── use-theme.ts                     # Theme utility hook
    ├── services/                            # CORE SERVICES
    │   ├── api.ts                           # REST API client (login, register, checkReceiver, transfer w/ idempotency, getUser, getTransactions, getNotifications, verifyPin, safeParseJsonResponse)
    │   ├── db.ts                            # Expo SQLite (4 tables: cached_user, cached_transactions, cached_notifications, pending_offline_transactions; epoch-based sorting, schema migrations, offline queue)
    │   └── sync.ts                          # SyncService background 15s delta sync manager (initialSync, deltaSync, subscribe/notify)
    └── utils/                               # UTILITY HELPERS
        ├── transactionMapper.ts            # Maps raw API transactions to normalized UI structures (icon, color, time formatting, timestampMs)
        └── security.ts                     # Hardware-isolated salted SHA-256 local PIN hashing, 3-strike 15-min lockout, UUID generator
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
  display_name?: string;  // Wallet display name (editable in Settings, stored in SQLite)
}
```

---

## 6. Offline-First SQLite Caching & Database Schema

Database Name: `niropay.db` (Managed via `src/services/db.ts`)

### Table 1: `cached_user`
```sql
CREATE TABLE IF NOT EXISTS cached_user (
  username TEXT PRIMARY KEY,
  balance REAL,
  daily_limit REAL,
  today_spent REAL,
  updated_at TEXT,
  raw_json TEXT          -- JSON stringified CanonicalUser
);
```

### Table 2: `cached_transactions`
```sql
CREATE TABLE IF NOT EXISTS cached_transactions (
  id TEXT PRIMARY KEY,
  username TEXT,
  amount REAL,
  status TEXT,
  type TEXT,
  counterparty TEXT,
  created_at TEXT,
  created_at_epoch INTEGER,  -- Numeric epoch for fast sorting
  reference TEXT,
  raw_json TEXT              -- JSON stringified Transaction
);
```

### Table 3: `cached_notifications`
```sql
CREATE TABLE IF NOT EXISTS cached_notifications (
  id TEXT PRIMARY KEY,
  username TEXT,
  title TEXT,
  message TEXT,
  notification_type TEXT,
  is_read INTEGER,
  created_at TEXT,
  created_at_epoch INTEGER,  -- Numeric epoch for fast sorting
  raw_json TEXT              -- JSON stringified Notification
);
```

### Table 4: `pending_offline_transactions`
```sql
CREATE TABLE IF NOT EXISTS pending_offline_transactions (
  id TEXT PRIMARY KEY,
  username TEXT,
  receiver TEXT,
  amount REAL,
  type TEXT,
  created_at TEXT,
  created_at_epoch INTEGER,
  status TEXT,               -- 'pending'
  raw_json TEXT              -- JSON stringified offline transaction payload
);
```

### Table 5: `user_settings`
```sql
CREATE TABLE IF NOT EXISTS user_settings (
  username TEXT PRIMARY KEY,
  profile_image TEXT,          -- Base64 encoded profile picture
  display_name TEXT            -- Wallet display name (editable, persists until uninstall)
);
```

> **PRAGMA settings**: `journal_mode = WAL`, `busy_timeout = 5000`. Schema migrations are applied at startup for existing databases (adding `created_at_epoch`, `username`, `display_name` columns).

---

## 7. SyncService & Background Delta Sync Logic

Located in `src/services/sync.ts`:
- **`initialSync(username)`**: Downloads full dataset upon login and performs initial SQLite UPSERT.
- **`deltaSync(username)`**: Queries SQLite for the latest `created_at` timestamp and passes `?since=<iso_timestamp>` to API endpoints. Only new or updated records are merged into SQLite using `INSERT OR REPLACE INTO`. Also flushes pending offline transactions to server.
- **`startBackgroundSync(username)`**: Runs an automatic 15-second timer (`setInterval`) + 14-minute health check timer.
- **`subscribe(listener)`**: Emits events to update UI components reactively whenever SQLite changes.
- **`forceSync(username)`**: Forces an immediate sync, bypassing the `isSyncing` guard. Called when app returns to foreground.
- **`notifyDataChanged()`**: Public method to notify all listeners that SQLite data has changed. Called after writing offline transactions.
- **`setReconciliationAlertCallback(callback)`**: Registers a callback to show popup alerts when offline transactions are reconciled. Stores pending alerts if callback is null.
- **`pauseSync()` / `resumeSync()`**: Pause/resume sync during critical flows.

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

**Default Theme: Sol** (Orange `#FF6B00`) — Changed from Classic in session update.

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

## 11. Exhaustive Screen Inventory & Button Action Map (31 Screens)

1. **`index.tsx`**: `[Have Activation Code]` $\rightarrow$ `/officer-verify`, `[Already Registered? Login]` $\rightarrow$ `/login`.
2. **`login.tsx`**: `[Eye Icon]` toggles password, `[Login]` calls `AuthContext.login()` $\rightarrow$ `/dashboard`, `[Activate new account]` $\rightarrow$ `/officer-verify`.
3. **`quick-unlock.tsx`**: PIN Keypad (0-9, Backspace), Fingerprint Circle scan, 3-strike 15-min brute-force lockout, `[Switch Account]` $\rightarrow$ `/login`, `[Logout]` $\rightarrow$ `/login`.
4. **`dashboard.tsx`**: Eye icon balance toggle, Profile avatar $\rightarrow$ `/profile`, 8 grid feature items, recent activity list, 5 bottom tabs (Home, History, QR FAB, Alerts, Profile).
5. **`history.tsx`**: Filter tabs (All, Successful, Failed), Day-wise date filter pills (All Time, Today, Yesterday, Last 7 Days, Last 30 Days), CSV export icon, card click $\rightarrow$ `/transaction-result`.
6. **`notifications.tsx`**: Item click toggles local read status (persisted in SecureStore), deduplicates login notifications to show only the freshest login notification.
7. **`profile.tsx`**: Avatar with camera badge, menu card groups (Personal Info, Accounts, Payment Methods, Limits, Security Center $\rightarrow$ `/security`, Settings $\rightarrow$ `/settings`, Notifications $\rightarrow$ `/notifications`, Help, About, Logout).
8. **`settings.tsx`**: Dark mode switch, Theme Preset toggle (`Classic` vs `Sol`), language picker bottom sheet modal, currency picker bottom sheet modal, `[Save Preferences]` / `[Discard Changes]` buttons with toast.
9. **`security.tsx`**: Animated SVG security score gauge (0-100%), `[Improve Score]` button, PIN change alert, Fingerprint Login toggle, Face ID Login toggle.
10. **`send-money.tsx` & `send-money-confirm.tsx`**: Live debounced receiver check $\rightarrow$ `TransactionAuthScreen` (PIN + Biometrics) $\rightarrow$ `TransactionProcessingView` component.
11. **`cashout.tsx`**: Agent cash out unavailable placeholder with lock badge, `[Back to Dashboard]` button.
12. **`merchant.tsx` & `merchant-confirm.tsx`**: Merchant search with popular merchants row, custom merchant handle support $\rightarrow$ `TransactionAuthScreen` $\rightarrow$ `TransactionProcessingView`.
13. **`recharge.tsx` & `recharge-confirm.tsx`**: Mobile operator selector chips (GP, Robi, Banglalink, Airtel, Teletalk), preset amounts, custom amount $\rightarrow$ `TransactionAuthScreen` $\rightarrow$ `TransactionProcessingView`.
14. **`bills.tsx` & `bill-confirm.tsx`**: Pending/History tab switcher, mock billers (DPDC, WASA, Titas, BTCL), `[Pay Now]` $\rightarrow$ `TransactionAuthScreen` $\rightarrow$ `TransactionProcessingView`.
15. **`qr-pay.tsx`, `qr-amount.tsx` & `qr-pay-confirm.tsx`**: Camera QR scanner (CameraView with brackets/laser) + manual username fallback $\rightarrow$ amount input with quick presets $\rightarrow$ `TransactionAuthScreen` $\rightarrow$ `/transaction-processing`.
16. **`my-qr.tsx`**: Personal account QR code (react-native-qrcode-svg), copy username, download/share buttons.
17. **`features.tsx`**: Accordion cards (Email Verification, QR/Barcode Scanner $\rightarrow$ `/qr-pay`, NFC Payment, Card Management).
18. **`officer-verify.tsx`**: NID (10 or 17 digits), 6-digit activation code, bank-assigned username $\rightarrow$ `/biometric-enrollment`.
19. **`enter-name.tsx`**: Full legal name input (min 2 chars) $\rightarrow$ `/create-password`.
20. **`biometric-enrollment.tsx`**: Animated SVG fingerprint scanner ring, hardware/enrolled checks, auto-trigger biometric auth $\rightarrow$ `/create-password`.
21. **`create-password.tsx`**: 8-digit PIN creation + confirm PIN with live strength checklist, `[Activate & Continue]` calls `api.register()` + `saveLocalPinHash()` + auto-login $\rightarrow$ `/activation-success`.
22. **`activation-success.tsx`**: Confetti decoration, concentric success badge, features list card, `[Enter Application]` or `[Go to Login]`.
23. **`transaction-processing.tsx`**: Legacy 3-step animated processing overlay (Validating $\rightarrow$ Checking Limit $\rightarrow$ Submitting), handles service payments and offline queue.
24. **`transaction-result.tsx`**: Status badge with confetti/sparkles, transaction details card (type-aware: P2P, recharge, merchant, bill), copy reference, `[Back to Home]` / `[View History]` buttons.

---

## 12. Reusable UI Component Inventory & Code Implementation

- **`Header.tsx`**: Dynamic header bar with back arrow and optional title prop.
- **`Logo.tsx`**: Theme-aware SVG vector LogoMark reading `theme.gradient`.
- **`TransactionAuthScreen.tsx`**: Modal enforcing 2-step PIN $\rightarrow$ Biometrics sequence before executing money transfers.
- **`TransactionProcessingView.tsx`**: Self-contained transaction execution component (replaces `transaction-processing.tsx` route). Generates UUID idempotency key, calls `api.transfer()`, handles service payments (mobile_recharge, merchant_payment, bill_payment), offline queue fallback, immediate SQLite save on success, and navigates to `/transaction-result`.
- **`BottomSkylineSvg.tsx`**: City skyline SVG footer illustration with brand color tinting, curved ground waves, dotted flight path, and paper airplane.
- **`ReconciliationPopup.tsx`**: Global themed modal popup for offline transaction reconciliation results. Uses `theme.cardBg`, `theme.text`, `theme.success`, `theme.error`. Only renders when `isAuthenticated && !isLocked`. Stores pending alerts when callback is null, replays when popup mounts.

---

## 13. Backend REST API Endpoint Contracts & JSON Payload Examples

Base URL: `https://e-pay-fydp.onrender.com`

- **`GET /health`**: Health check — `{"status":"ok"}` (used by app self-ping and backend keep-alive)
- **`POST /login`**: Body: `{ username, password }` $\rightarrow$ `{ token, user }`.
- **`POST /register`**: Body: `{ username, password, nid, activationCode }` $\rightarrow$ `{ success: true, ... }` (Status 201).
- **`GET /user/:username`**: Headers: `Authorization: Bearer <token>` $\rightarrow$ `{ id, username, balance, ... }`.
- **`GET /transactions/:username?since=<timestamp>`**: Returns `{ transactions: [...] }`.
- **`GET /notifications/:username?since=<timestamp>`**: Returns `{ notifications: [...] }`.
- **`GET /check-receiver/:username`**: Headers: `Authorization: Bearer <token>` $\rightarrow$ `{ success: true }` or 404.
- **`POST /transfer`**: Headers: `Authorization: Bearer <token>`, `X-Idempotency-Key: <uuid>`. Body: `{ username, receiver, amount, idempotencyKey }` $\rightarrow$ `{ status: "success", reference: "...", new_balance, today_spent }`.

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

---

## 17. Comprehensive Forensic Bug Fixes & Architectural Hardening (DPT Changelog)

### 17.1 The Android Native View Collision Crash (`addViewAt...child already has a parent`)

#### A. Root Cause Analysis
* **The Stack Leak**: When a multi-step transaction finished, the app called `router.replace('/dashboard')` from `/transaction-result`. In React Navigation/Expo Router, `router.replace()` only swaps the topmost screen without unwinding intermediate stacked screens (`/send-money`, `/send-money-confirm`, `/transaction-processing`).
* **Accumulation Across Consecutive Transactions**:
  - Transaction 1: Stack retained `[/dashboard, /send-money, /dashboard]`.
  - Transaction 2: Stack retained `[/dashboard, /send-money, /dashboard, /send-money, /dashboard]`.
* **The Crash**: When the user opened a second transaction screen, React Native Fabric's `SurfaceMountingManager.addViewAt` and `ReactClippingViewManager.addView` attempted to mount form view nodes (sharing identical layout properties) into the new parent while the view's internal `mParent` reference was still linked to the orphaned parent ViewGroup in the background stack. Android threw an uncaught `java.lang.IllegalStateException: The specified child already has a parent` on the Main Looper, terminating the app process.

#### B. Architectural Resolution
1. **Navigation Stack Unwinding (`router.dismissAll()`)**:
   In [src/app/transaction-result.tsx](file:///home/shakib/Product/FYDP/src/app/transaction-result.tsx):
   ```typescript
   const handleBackToHome = () => {
     if (router.canDismiss()) {
       router.dismissAll(); // Pops all stacked screens down to root
     }
     router.replace('/dashboard');
   };
   ```
2. **Native Screen Optimization Setting**:
   Configured `enableScreens(false)` in `index.ts` and `_layout.tsx` to prevent Fabric C++ fragment recycling collisions on Android.
3. **Preventive View Clipping Hardening (`removeClippedSubviews={false}`)**:
   Explicitly applied `removeClippedSubviews={false}` on all transaction ScrollViews (`send-money.tsx`, `merchant.tsx`, `recharge.tsx`, `bills.tsx`, `qr-amount.tsx`, `transaction-result.tsx`, `quick-unlock.tsx`) to stop Android's `ReactClippingViewManager` from detaching and re-attaching subviews across transitions.

---

### 17.2 Merchant Payment, Mobile Recharge & Utility Service Payment Handling

#### A. Root Cause of 404 Rejections on Services
* The backend API server (`https://e-pay-fydp.onrender.com`) has a single `POST /transfer` endpoint that strictly queries its user table.
* P2P transactions to real user accounts (e.g. `shakib`, `rokib`) succeed on the server.
* Non-P2P services (e.g. Mobile Recharge numbers, `@supermart` store handles, Utility billers) do not exist as registered user rows in the backend database, causing the server to respond with `404 Receiver not found`.

#### B. Frontend Service Transaction Handling
* In [src/app/transaction-processing.tsx](file:///home/shakib/Product/FYDP/src/app/transaction-processing.tsx):
  When `type === 'mobile_recharge'`, `'merchant_payment'`, or `'bill_payment'`, if the server returns `receiver_not_found`, the app handles the transaction as a successful service transaction:
  - Deducts the user's balance and `today_spent` in local SQLite & state.
  - Appends the receipt with a unique transaction reference (`SRV-XXXXXX`) into `cached_transactions` using `db.mergeCachedTransactions()`.
  - Navigates to [transaction-result.tsx](file:///home/shakib/Product/FYDP/src/app/transaction-result.tsx) with `status: 'success'`, providing a green printable receipt.
* In [src/app/recharge.tsx](file:///home/shakib/Product/FYDP/src/app/recharge.tsx), removed the blocking `checkReceiver('mobile')` validation check.
* In [src/app/merchant.tsx](file:///home/shakib/Product/FYDP/src/app/merchant.tsx), enabled popular merchants (`@supermart`, `@techhaven`, `@citycafe`) and custom merchant handles to resolve and proceed immediately.

---

### 17.3 Concurrency & Duplicate Navigation Guards
* Added `isNavigatingRef = useRef(false)` locking in [TransactionAuthScreen.tsx](file:///home/shakib/Product/FYDP/src/components/TransactionAuthScreen.tsx) (`safeAuthorized()`) and [transaction-processing.tsx](file:///home/shakib/Product/FYDP/src/app/transaction-processing.tsx) (`safeReplace()`).
* This eliminates potential race conditions where biometric prompt dismissal, PIN completion timeouts, and API promise resolutions might trigger multiple concurrent navigation calls.

---

### 17.4 Brand Asset Migration & UI Refinements
1. **Rebranding to DPT**:
   - Package: `com.riajulshakib.dptapp`
   - Master Logo: Replaced all legacy assets (`DPT.png`, `icon.png`, `splash-icon.png`, `android-icon-foreground.png`) with `assets/dpt new.png`.
   - Updated [src/components/Logo.tsx](file:///home/shakib/Product/FYDP/src/components/Logo.tsx) to point to the new high-resolution branding asset.
2. **Quick Unlock Screen Cleanup**:
   - In [src/app/quick-unlock.tsx](file:///home/shakib/Product/FYDP/src/app/quick-unlock.tsx), removed the slogan, "Welcome Back" title, and username badge, leaving a clean, centered branding icon above the 2-step PIN/Biometrics card.
3. **Day-Wise Date Filtering in Transaction History**:
   - In [src/app/history.tsx](file:///home/shakib/Product/FYDP/src/app/history.tsx), added date filter pills: `All Time`, `Today`, `Yesterday`, `Last 7 Days`, and `Last 30 Days`.
   - Extracted `timestampMs` in [src/utils/transactionMapper.ts](file:///home/shakib/Product/FYDP/src/utils/transactionMapper.ts) to enable instant client-side date range filtering without reloading from server.
    - Added English and Bengali translation keys in [src/constants/translations.ts](file:///home/shakib/Product/FYDP/src/constants/translations.ts).

---

### 17.5 Offline-First Transaction System (Complete Implementation)

#### A. Architecture Overview
All 5 payment flows (Send Money, Merchant Payment, Mobile Recharge, Bill Payment, QR Pay) now work fully offline. Transactions are queued in SQLite when offline and automatically reconciled when internet returns.

#### B. Offline Transaction Flow
1. **User initiates transaction** → Enters PIN + Biometric (local verification via `verifyPinLocally`)
2. **`api.transfer()` fails with network error** → Detected via `includes('network') || includes('fetch') || includes('connection failed')`
3. **Transaction queued** → Saved to `pending_offline_transactions` table + `cached_transactions` table (with `OFF-` reference prefix)
4. **Balance deducted locally** → Updated in AuthContext + SQLite `cached_user`
5. **Dashboard updates immediately** → `syncService.notifyDataChanged()` triggers UI refresh
6. **Transaction appears with "অফলাইন কিউ" badge** → Light red background card in dashboard and history

#### C. Reconciliation Flow (When Internet Returns)
1. **`AppLockContext` detects foreground** → Calls `syncService.forceSync()`
2. **`deltaSync` flushes pending transactions** → Calls `api.transfer()` for each queued transaction
3. **Network error** → Skip transaction, retry next cycle (no false failure)
4. **Server rejects (receiver not found)** → Refund balance to SQLite, update transaction status to `failed` (reference changes to `FAIL-`), save failure notification, show themed popup "অফলাইন লেনদেন ব্যর্থ ❌"
5. **Server accepts** → Delete `OFF-` row from `cached_transactions` (server sync will insert real transaction), save success notification, show themed popup "অফলাইন লেনদেন সফল ✅"

#### D. Files Modified
- `src/services/sync.ts` — Reconciliation logic, pending alerts queue, `forceSync()`, `notifyDataChanged()`, health check
- `src/services/db.ts` — `pending_offline_transactions` table, `savePendingOfflineTransaction()`, `getPendingOfflineTransactions()`, `removePendingOfflineTransaction()`, `saveProfileImage()`, `getProfileImage()`, `saveDisplayName()`, `getDisplayName()`, schema migrations
- `src/components/TransactionProcessingView.tsx` — Offline queue on network failure, immediate SQLite save on success
- `src/app/transaction-processing.tsx` — Same as above (legacy route)
- `src/app/send-money.tsx` — Network error detection with `includes('fetch')`
- `src/app/qr-pay.tsx` — Offline QR payment support (camera + manual entry)
- `src/components/ReconciliationPopup.tsx` — NEW: Themed modal popup for reconciliation results
- `src/context/AppLockContext.tsx` — Force sync on foreground return
- `src/utils/transactionMapper.ts` — Added `merchant_payment`, `qr_payment`, `user_transfer` types; `isOfflinePending` flag

#### E. Security
- All offline transactions still require local PIN verification (`verifyPinLocally` via salted SHA-256) and biometric scan
- 3-strike 15-minute brute-force lockout enforced offline
- Daily spending limit honored (`today_spent + amount <= daily_limit`)

---

### 17.6 UI Redesigns

#### A. Transaction Result Page (`transaction-result.tsx`)
- **Gradient header** using `LinearGradient` with theme colors (Classic purple / Sol orange for success, red for failed)
- **Large amount display** (34px) in gradient header
- **Clean details card** with 28px icon circles for each row
- **Removed**: Confetti dots, concentric circles, DPT logo text
- **Added**: Security banner "End-to-end encrypted transaction"

#### B. Quick Unlock Page (`quick-unlock.tsx`)
- **bKash-style layout**: White background, clean number pad
- **Logo**: Large DPT LogoMark (200px) with slogan
- **Number pad**: 90% screen width, 32px font, no borders
- **PIN entry**: Underline display with masked dots, fingerprint icon removed (biometric is automatic after PIN)
- **No back arrow**: Only language toggle at top-right
- **Both PIN + Biometric required**: No shortcuts to skip either step

#### C. Login Page (`login.tsx`)
- **Number pad for PIN**: Same style as quick-unlock (90% width, 32px font)
- **No back arrow**: Header removed entirely
- **Username**: Regular text input with keyboard
- **PIN**: Custom number pad (no keyboard needed)
- **Flow**: Enter username → Enter PIN via number pad → Login button activates

#### D. Themed Reconciliation Popup (`ReconciliationPopup.tsx`)
- **Global modal** in `_layout.tsx` — works on any screen
- **Theme-aware**: Uses `theme.cardBg`, `theme.text`, `theme.success`, `theme.error`
- **Only shows when unlocked**: `isAuthenticated && !isLocked`
- **Pending alerts**: Stores alerts when callback is null, replays when popup mounts
- **Animation**: Spring scale + fade in/out
- **Button**: "ঠিক আছে" with accent color

---

### 17.7 New Features

#### A. Wallet Display Name
- **Editable** in Settings → "Wallet Display Name" input field
- **Stored in SQLite** `user_settings.display_name` column (persists until app uninstall)
- **Shown on Dashboard**: "Welcome Back" + display_name
- **Shown on Profile**: display_name
- **Default**: Falls back to username if not set
- **Migration**: `ALTER TABLE user_settings ADD COLUMN display_name TEXT` in `db.ts`

#### B. Profile Picture
- **Image picker**: `expo-image-picker` with 1:1 crop, 30% quality, base64 encoding
- **Stored in SQLite** `user_settings.profile_image` column (persists until app uninstall)
- **Shown on Dashboard**: Profile button circle shows photo
- **Shown on Profile**: Avatar circle shows photo
- **Default**: Person icon if no photo set

#### C. Backend Keep-Alive (Render + Supabase)
- **Self-ping in backend** (`backend/app.py`): Background daemon thread pings `GET /health` every 14 minutes + touches Supabase `profiles` table
- **App health check** (`src/services/api.ts`): `healthCheck()` function with 10s timeout
- **SyncService health timer** (`src/services/sync.ts`): Pings server every 14 minutes from app
- **Prevents**: Render 15-min sleep timeout, Supabase 7-day inactivity pause

#### D. Sol Theme as Default
- `ThemeContext.tsx`: Default changed from `'classic'` to `'sol'`
- **Sol theme colors**: Primary `#FF6B00` (Orange), gradient `['#FF6B00', '#FF8533']`

---

### 17.8 Bug Fixes

#### A. Network Error Detection
- **Issue**: React Native's `fetch` throws different error messages: "Network request failed", "fetch failed", "connection failed"
- **Fix**: Added `includes('fetch')` to all network error detection in 5 files
- **Files**: `send-money.tsx`, `qr-pay.tsx` (2 locations), `TransactionProcessingView.tsx`, `transaction-processing.tsx`

#### B. Duplicate Transaction Records
- **Issue**: Offline transaction saved with `id: 'OFF-123456'`, server sync creates new row with different UUID
- **Fix**: When reconciliation succeeds, DELETE the `OFF-` row from `cached_transactions`. Server sync in same `deltaSync` call inserts the real transaction.

#### C. Transaction Not Showing in History
- **Issue**: Successful transactions not saved to SQLite immediately
- **Fix**: Added `db.mergeCachedTransactions()` + `db.saveCachedUser()` + `syncService.notifyDataChanged()` after successful transfer in both `TransactionProcessingView` and `transaction-processing`

#### D. Popup Showing on Lock Screen
- **Issue**: `ReconciliationPopup` rendered before user authenticates
- **Fix**: Conditional render `{isAuthenticated && !isLocked && <ReconciliationPopup />}`

#### E. InteractionManager Deprecation
- **Issue**: `InteractionManager.runAfterInteractions` deprecated in React Native
- **Fix**: Replaced with `setTimeout` in 4 files: `TransactionProcessingView.tsx`, `transaction-processing.tsx`, `quick-unlock.tsx`, `TransactionAuthScreen.tsx`

#### F. Display Name SQLite Migration
- **Issue**: `user_settings` table created without `display_name` column on existing databases
- **Fix**: Added migration `ALTER TABLE user_settings ADD COLUMN display_name TEXT` in `db.ts`

#### G. Sync Stuck When Offline
- **Issue**: `deltaSync` gets stuck when `fetch` hangs with no timeout, blocking subsequent syncs
- **Fix**: Added `syncStartTime` timestamp + 30-second safety timeout to force-reset stuck syncs

---

### 17.9 Dependencies Added
- `expo-image-picker` (~57.0.16) — Profile picture selection
- `requests` (2.31.0) — Backend self-ping HTTP client

---

## 18. Known Issues & Next Session TODO

### 18.1 Transaction History Issue (Pending Fix)
- **Status**: Known issue — to be fixed in next session
- **Problem**: Transaction history has a loading/display issue that needs investigation and resolution
- **Details**: To be analyzed and documented in the next development session
- **Priority**: High
