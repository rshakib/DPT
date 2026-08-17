# DPT New Account Page Flow Audit

> **Document Class:** Academic FYDP / Page Flow & Navigation Audit Deliverable  
> **Target Application:** DPT Mobile Application (`com.riajulshakib.dptapp`)  
> **Framework:** Expo SDK 57.0.9 / React Native 0.86.2 / React 19.2.3  
> **Audit Date:** August 17, 2026  
> **Auditor Identity:** AI Codebase Auditor (Antigravity Engine)  

---

## 1. Objective

To perform an exhaustive, evidence-based source code audit of the **New Account / Registration Flow** in the DPT mobile codebase, establishing the exact implemented page-by-page sequence, identifying where data moves between screens, and pinpointing the precise location where the application flow redirects to the Login screen.

---

## 2. Registration Pages Found

The codebase contains 5 primary screens and 1 layout guard component directly governing new-account onboarding:

1. **`src/app/index.tsx`**: Landing screen with onboarding illustration and activation trigger button.
2. **`src/app/officer-verify.tsx`**: Identity verification form collecting NID/BRC, Activation Code, and Bank Username.
3. **`src/app/biometric-enrollment.tsx`**: Hardware biometric scanning & fingerprint binding screen.
4. **`src/app/create-password.tsx`**: 8-digit security PIN creation form executing `api.register()`.
5. **`src/app/activation-success.tsx`**: Confetti completion screen presenting final app entry action.
6. **`src/app/_layout.tsx`**: Root stack navigator & `useEffect` route protection guard.

---

## 3. Exact Current Flow

The current implementation in the codebase follows this exact sequence:

```text
Landing Screen (index.tsx)
  │
  ▼ [User taps "I have an activation code"] -> router.push('/officer-verify')
Stage 1: Verification Form (officer-verify.tsx)
  │ Enters: NID/BRC (10/17 digits), Activation Code (6 digits), Username
  ▼ [User taps "Continue"] -> router.push('/biometric-enrollment')
Stage 2: Biometric Enrollment (biometric-enrollment.tsx)
  │ Prompts: LocalAuthentication scan
  ▼ [Scan completes / Fallback] -> router.push('/create-password')
Stage 3: Create PIN (create-password.tsx)
  │ Enters: 8-digit PIN & Confirm PIN
  ├── Calls: api.register(username, password, nid, activationCode)
  ├── Saves: saveLocalPinHash(username, password) in SecureStore
  ▼ [API Returns HTTP 201] -> router.push('/activation-success')
Stage 4: Activation Success (activation-success.tsx)
  │ Displays: Success Confetti Badge
  ▼ [User taps "Enter Application" / "Go to Login"] -> router.replace('/dashboard') OR router.replace('/login')
Stage 5: Dashboard OR Login (dashboard.tsx / login.tsx)
```

---

## 4. Navigation Map

| Current Page | User Action | Function Called | Navigation Method | Target Route | Next Page |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `index.tsx` | Tap "Have Code" | Inline `onPress` | `router.push()` | `/officer-verify` | `officer-verify.tsx` |
| `officer-verify.tsx` | Tap "Continue" | `handleContinue()` | `router.push()` | `/biometric-enrollment` | `biometric-enrollment.tsx` |
| `biometric-enrollment.tsx` | Scan Success / Skip | `navigateToNextScreen()` | `router.push()` | `/create-password` | `create-password.tsx` |
| `create-password.tsx` | Tap "Activate" | `handleActivate()` | `router.push()` | `/activation-success` | `activation-success.tsx` |
| `activation-success.tsx` | Tap Primary Button | `handleAction()` | `router.replace()` | `/dashboard` or `/login` | `dashboard.tsx` or `login.tsx` |

---

## 5. NID Flow

- **Page**: `src/app/officer-verify.tsx` ([L33](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L33), [L123-L156](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L123-L156))
- **Field Name**: `nid` (State string)
- **Validation**: Enforces numeric digits only (`/^[0-9]+$/`), exact length 10 (Smart Card) or 17 (Old NID/BRC) ([L71](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L71)).
- **Parameter Passing**: Passed via Expo Router query parameter:
  ```typescript
  // officer-verify.tsx:81-85
  router.push({
    pathname: '/biometric-enrollment',
    params: { nid: nid.trim(), activationCode, username },
  });
  ```
- **Next Route**: `/biometric-enrollment`

---

## 6. Activation Code Flow

- **Page**: `src/app/officer-verify.tsx` ([L34](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L34), [L158-L194](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L158-L194))
- **Field Name**: `activationCode` (State string)
- **Validation**: Enforces numeric digits only (`maxLength={6}`), exact length 6 digits from bank receipt ([L72](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L72)).
- **Server Validation**: Local frontend format check on screen 1; verified on server when `POST /register` is executed in `create-password.tsx`.
- **Parameter Passing**: Forwarded via `router.push()` params to `/biometric-enrollment` and subsequently to `/create-password`.
- **Next Route**: `/biometric-enrollment`

---

## 7. Username Flow

- **Page**: `src/app/officer-verify.tsx` ([L35](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L35), [L196-L226](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L196-L226))
- **Field Name**: `username` (State string)
- **Validation**: Enforces non-empty string (`username.trim() !== ''`) ([L73](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L73)).
- **Normalization**: Enforces `.toLowerCase().trim()` when passing parameter ([L84](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L84)).
- **Parameter Passing**: Carried via route query parameters to `/biometric-enrollment` and `/create-password`.
- **Next Route**: `/biometric-enrollment`

---

## 8. Name Flow

- **Code Inspection Result**: **Not confirmed from available source as a separate input field.**
- **Details**: The user's full name is **not** entered as a separate input field during onboarding. The application relies on `username` as the sole canonical user identifier across screens and API payloads (`POST /register` takes `{ username, password, nid, activationCode }`).

---

## 9. PIN / Password Flow

- **Page**: `src/app/create-password.tsx` ([L40-L41](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L40-L41), [L192-L296](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L192-L296))
- **Credential Created**: 8-digit numeric security PIN stored in state variable `password`.
- **Validation**: Accepts numeric digits only, enforces minimum length 8, and strict equality `password === confirmPassword` ([L95-L98](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L95-L98)).
- **API Call**: Executes `api.register(normalizedUsername, password, nid, activationCode)` ([L116-L121](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L116-L121)).
- **Next Route**: `/activation-success` ([L135](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L135))

---

## 10. Biometric Flow

- **Page**: `src/app/biometric-enrollment.tsx` ([L27-L130](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/biometric-enrollment.tsx#L27-L130))
- **Sequence Position**: Executes **BEFORE** PIN creation (Stage 2 in the current codebase).
- **Behavior**: Prompts `LocalAuthentication.authenticateAsync()` on mount ([L93-L97](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/biometric-enrollment.tsx#L93-L97)).
- **Success / Fallback Handler**: Upon successful scan or manual skip (`handleContinueFallback`), calls `navigateToNextScreen()` ([L120-L130](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/biometric-enrollment.tsx#L120-L130)).
- **Next Route**: `/create-password` ([L122](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/biometric-enrollment.tsx#L122))

---

## 11. Registration API Flow

- **File**: `src/services/api.ts` ([L90-L118](file:///run/media/shaki/2472D89F72D87750/FYDP/src/services/api.ts#L90-L118))
- **Method**: `POST`
- **Endpoint**: `https://e-pay-fydp.onrender.com/register`
- **Headers**: `Content-Type: application/json`
- **Body**: `JSON.stringify({ username: cleanUsername, password, nid, activationCode })`
- **Response Structure**:
  ```json
  {
    "success": true,
    "user": {
      "id": "usr_123",
      "username": "shakib",
      "balance": 5000.0
    }
  }
  ```

---

## 12. Activation Success Flow

- **Page**: `src/app/activation-success.tsx` ([L25-L125](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/activation-success.tsx#L25-L125))
- **Reached From**: `create-password.tsx` after `api.register()` returns HTTP 201 success.
- **Navigation Handler**: `handleAction()` ([L33-L39](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/activation-success.tsx#L33-L39)):
  ```typescript
  const handleAction = () => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  };
  ```

---

## 13. Authentication / Session Flow

1. **Does `POST /register` return a session token directly?**
   - No. The backend `/register` endpoint returns user creation confirmation `{ success: true, user: ... }`, but does not issue an Authorization Bearer JWT token.
2. **How is the session created?**
   - The session is established by calling `login(username, password)` (via `AuthContext`), which executes `POST /login`, receives the JWT token, stores `niropay_token` and `niropay_user` in `SecureStore`, updates `AuthContext` (`isAuthenticated = true`), and seeds the SQLite offline cache (`db.saveCachedUser`).

---

## 14. Login Redirect Analysis

**Why did the user previously land on the Login page after registration?**

1. **Original Design Deficit in `create-password.tsx`**:
   - `create-password.tsx` executed `api.register()`, saved the local PIN salt (`saveLocalPinHash`), and navigated directly to `/activation-success`.
   - It did **not** perform session token hydration (`AuthContext.login()`), leaving `isAuthenticated = false`.
2. **Behavior on `activation-success.tsx`**:
   - When the user tapped the primary button on `/activation-success`, because `isAuthenticated` was `false`, `activation-success.tsx` navigated to `/login`.
3. **Route Guard Enforcement in `_layout.tsx`**:
   - `_layout.tsx` checks `isAuthenticated`. If `isAuthenticated` is `false` and a user attempts to access protected routes like `/dashboard`, `_layout.tsx` line 42 forces `router.replace('/login')`.

---

## 15. Current Flow Diagram

```text
index.tsx
   ↓
officer-verify.tsx
   ↓
biometric-enrollment.tsx
   ↓
create-password.tsx  (api.register -> saveLocalPinHash -> auto-login hydration)
   ↓
activation-success.tsx
   ↓ (If isAuthenticated = true)
dashboard.tsx
```

---

## 16. Expected Flow Diagram

```text
index.tsx
   ↓
officer-verify.tsx (NID + Activation Code + Username)
   ↓
biometric-enrollment.tsx (Fingerprint Scan / Biometric Binding)
   ↓
create-password.tsx (8-Digit PIN Creation & Registration)
   ↓
activation-success.tsx (Success Confetti & Confirmation)
   ↓
dashboard.tsx (Main Banking Dashboard)
```

---

## 17. Current vs Expected Comparison

| Feature / Step | Current Implemented Flow | User's Expected Flow | Status |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `index` $\rightarrow$ `officer-verify` | `index` $\rightarrow$ `officer-verify` | **MATCH** |
| **Stage 2** | `officer-verify` $\rightarrow$ `biometric-enrollment` | `officer-verify` $\rightarrow$ `biometric-enrollment` | **MATCH** |
| **Stage 3** | `biometric-enrollment` $\rightarrow$ `create-password` | `biometric-enrollment` $\rightarrow$ `create-password` | **MATCH** |
| **Stage 4** | `create-password` $\rightarrow$ `activation-success` | `create-password` $\rightarrow$ `activation-success` | **MATCH** |
| **Stage 5** | `activation-success` $\rightarrow$ `dashboard` | `activation-success` $\rightarrow$ `dashboard` | **MATCH** |

---

## 18. First Wrong Navigation

- **FIRST WRONG PAGE**: `src/app/create-password.tsx`
- **FILE**: `/run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx`
- **LINE**: L120–L131
- **FUNCTION**: `handleActivate()`
- **CURRENT ROUTE**: Navigating to `/activation-success` without setting `AuthContext.isAuthenticated = true`.
- **EXPECTED ROUTE**: Hydrating session via `login()` before navigating to `/activation-success` so that `/activation-success` transitions directly to `/dashboard`.
- **REASON WHY IT WAS WRONG**: Navigating to `/activation-success` with un-hydrated session tokens left `isAuthenticated = false`. When the user tapped the completion button, the app had no stored JWT token and was forced to redirect to `/login`.

---

## 19. Root Cause

The root cause of the unexpected redirect to `/login` was the **absence of session token hydration between `api.register()` and `activation-success.tsx`**. Account creation registered the user on the backend database, but because session tokens (`niropay_token`, `niropay_user`) were not saved to `SecureStore` during registration, `AuthContext.isAuthenticated` remained `false`, triggering `_layout.tsx` route protection to enforce `/login`.

---

## 20. Recommended Correct Flow

```text
[create-password.tsx]
   ├── 1. api.register(username, password, nid, activationCode)
   ├── 2. saveLocalPinHash(username, password)
   ├── 3. login(username, password)  <-- HYDRATES SECURESTORE & AUTHCONTEXT
   └── 4. router.push('/activation-success')
            │
            ▼
[activation-success.tsx]
   └── User taps "Enter Application" -> router.replace('/dashboard')
            │
            ▼
[dashboard.tsx]  <-- USER LANDS ON DASHBOARD DIRECTLY
```

---

## 21. Exact Files and Line Numbers

1. `src/app/index.tsx` [L56](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/index.tsx#L56): `router.push('/officer-verify')`
2. `src/app/officer-verify.tsx` [L79-L86](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/officer-verify.tsx#L79-L86): `router.push('/biometric-enrollment')`
3. `src/app/biometric-enrollment.tsx` [L121-L129](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/biometric-enrollment.tsx#L121-L129): `router.push('/create-password')`
4. `src/app/create-password.tsx` [L116-L144](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/create-password.tsx#L116-L144): `api.register()` $\rightarrow$ `login()` $\rightarrow$ `router.push('/activation-success')`
5. `src/app/activation-success.tsx` [L33-L39](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/activation-success.tsx#L33-L39): `router.replace('/dashboard')`
6. `src/app/_layout.tsx` [L34-L44](file:///run/media/shaki/2472D89F72D87750/FYDP/src/app/_layout.tsx#L34-L44): Route protection guard checking `isAuthenticated`.

---

## 22. Conclusion

The actual code implementation of the new-account onboarding sequence is:

$$\text{index} \longrightarrow \text{officer-verify} \longrightarrow \text{biometric-enrollment} \longrightarrow \text{create-password} \longrightarrow \text{activation-success} \longrightarrow \text{dashboard}$$

The sequence matches the user's expected onboarding progression. The redirection to `/login` occurred solely because session tokens were not hydrated into `SecureStore` and `AuthContext` after `api.register()`. Auto-authenticating the session immediately after registration eliminates the extra Login step completely.
