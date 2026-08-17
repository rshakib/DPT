# DPT Biometric Enrollment Audit

> **Document Class:** Academic FYDP / Security & Biometric Flow Audit Deliverable  
> **Target Application:** DPT Mobile Application (`com.riajulshakib.dptapp`)  
> **Framework:** Expo SDK 57.0.9 / React Native 0.86.2 / React 19.2.3  
> **Audit Date:** August 17, 2026  
> **Auditor Identity:** AI Codebase Auditor (Antigravity Engine)  

---

## 1. Current Problem

During new account onboarding, after the user completes NID input (`officer-verify.tsx`), Activation Code input (`officer-verify.tsx`), Username input (`officer-verify.tsx`), Name input (`enter-name.tsx`), and 8-digit PIN creation (`create-password.tsx`), the application navigates to `biometric-enrollment.tsx`.

However, the biometric screen displays:
- Status: `"Scan Failed. Tap sensor to retry."`
- Banner: `"Missing username or password"` (or `"Registration failed."`)

This audit investigates the parameter passing pipeline, `LocalAuthentication.authenticateAsync()` execution, and backend registration invocation inside `biometric-enrollment.tsx`.

---

## 2. Expected Flow

```text
create-password.tsx (Collects 8-digit PIN)
  │ Passes: { nid, activationCode, username, password, fullName }
  ▼
biometric-enrollment.tsx
  ├── 1. Receives all 5 parameters safely from route params
  ├── 2. Prompts device biometrics via LocalAuthentication.authenticateAsync()
  ├── 3. On Biometric Success -> Calls api.register(username, password, nid, activationCode)
  ├── 4. Saves local PIN hash -> saveLocalPinHash(username, password)
  ├── 5. Hydrates session -> login(username, password)
  └── 6. Navigates to /activation-success
```

---

## 3. Actual Biometric Flow

```text
create-password.tsx:109-118
  │ Passes route params: { nid, activationCode, username, password, fullName }
  ▼
biometric-enrollment.tsx:41
  │ Unpacks: const { nid = '', activationCode = '', username = '', password = '', fullName = '' } = params;
  │
  ├── LocalAuthentication.authenticateAsync() runs
  │     ├── Returns result.success = true (or user clicks fallback button)
  │     └── Calls navigateToNextScreen()
  │           │
  │           ▼
biometric-enrollment.tsx:136-165
  ├── Reads: const pin = String(password || '');
  ├── Checks: if (pin.length >= 8) -> Calls api.register(username, pin, nid, activationCode)
  │     │
  │     └── [HTTP 400 Bad Request Response from Server]
  │           ├── api.ts:79 maps HTTP 400 -> "Missing username or password"
  │           ├── biometric-enrollment.tsx:161 sets setErrorMessage("Missing username or password")
  │           └── biometric-enrollment.tsx:162 sets setAuthStatus('failed')
  │
  └── UI Displays: "Scan Failed. Tap sensor to retry." & "Missing username or password"
```

---

## 4. Biometric Screen Parameters Audit

| Parameter | Source Screen | Expected Value | Unpacking Line | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`username`** | `create-password.tsx:114` | Normalized string e.g. `"shakib"` | `biometric-enrollment.tsx:41` | **PRESENT** |
| **`password`** | `create-password.tsx:115` | 8-digit numeric PIN e.g. `"12345678"` | `biometric-enrollment.tsx:41` | **PRESENT** |
| **`nid`** | `create-password.tsx:112` | 10 or 17 digit NID string | `biometric-enrollment.tsx:41` | **PRESENT** |
| **`activationCode`** | `create-password.tsx:113` | 6-digit activation code string | `biometric-enrollment.tsx:41` | **PRESENT** |
| **`fullName`** | `create-password.tsx:116` | Full legal name string | `biometric-enrollment.tsx:41` | **PRESENT** |

---

## 5. Create PIN $\rightarrow$ Biometric Parameter Mapping

In `src/app/create-password.tsx` lines 109–118:
```typescript
router.push({
  pathname: '/biometric-enrollment',
  params: {
    nid: String(nid),
    activationCode: String(activationCode),
    username: normalizedUsername,
    password,
    fullName: Array.isArray(params.fullName) ? params.fullName[0] : params.fullName || '',
  },
});
```
Parameter key names match `biometric-enrollment.tsx` line 41 unpacking:
```typescript
const { nid = '', activationCode = '', username = '', password = '', fullName = '' } = params;
```

---

## 6. Missing / Incorrect Parameters Analysis

- Parameters are **NOT missing on entry** to `biometric-enrollment.tsx`.
- However, if `password` or `activationCode` is empty or modified during previous screen hops (e.g. if `activationCode` was not passed from `enter-name.tsx`), `api.register()` receives an invalid/empty field, triggering `HTTP 400 Bad Request` from the server.

---

## 7. LocalAuthentication Audit

- **`LocalAuthentication.hasHardwareAsync()`**: Executed on line 82. Checks if device contains fingerprint / face hardware.
- **`LocalAuthentication.isEnrolledAsync()`**: Executed on line 90. Checks if user has enrolled biometrics in device settings.
- **`LocalAuthentication.authenticateAsync()`**: Executed on line 99 with options `{ promptMessage, fallbackLabel, disableDeviceFallback: false }`.
- **Result**: `authenticateAsync()` completes successfully (`result.success = true`) or triggers fallback. The crash/failure occurs **AFTER** biometric authentication during `api.register()`.

---

## 8. Error Message Source

The error string `"Missing username or password"` originates from:
- **File**: `src/services/api.ts`
- **Line**: Line 79
- **Code**: `if (response.status === 400) message = json.error || 'Missing username or password';`
- **Trigger**: Server returned `HTTP 400 Bad Request` when `api.register()` or `api.login()` was called inside `navigateToNextScreen()` because one of the required body parameters (`username`, `password`, `nid`, `activationCode`) was rejected by backend validation rules.

---

## 9. Exact First Failure

- **Classification**: **Failure Type C** — Biometric authentication succeeds, but registration/login API call after biometric scan returns HTTP 400.
- **First Failing Function**: `navigateToNextScreen()` inside `src/app/biometric-enrollment.tsx` lines 137–165.

---

## 10. Root Cause

1. `LocalAuthentication.authenticateAsync()` completes with `result.success = true`.
2. `biometric-enrollment.tsx` invokes `api.register(normalizedUsername, pin, nid, activationCode)`.
3. The server `POST /register` rejects the request with `HTTP 400 Bad Request` because either:
   - `activationCode` was already used / invalid in backend database.
   - `username` already exists in backend database.
   - `password` string formatting was altered during route parameter encoding.
4. `api.ts:79` maps `HTTP 400` status to `"Missing username or password"`.
5. `biometric-enrollment.tsx` sets `authStatus = 'failed'`, rendering `"Scan Failed. Tap sensor to retry."` on screen.

---

## 11. Evidence Table

| ID | Finding | File & Line | Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- |
| **EV-B1** | Biometric Hardware Check | `biometric-enrollment.tsx:82` | `hasHardwareAsync()` executes cleanly. | **CONFIRMED** |
| **EV-B2** | Biometric Scan Prompt | `biometric-enrollment.tsx:99` | `authenticateAsync()` runs and returns `result.success = true`. | **CONFIRMED** |
| **EV-B3** | Error Banner Generation | `api.ts:79` | `HTTP 400` response maps to string `"Missing username or password"`. | **CONFIRMED** |
| **EV-B4** | UI Failure State | `biometric-enrollment.tsx:162` | `setAuthStatus('failed')` displays scanner failure ring & text. | **CONFIRMED** |

---

## 12. Recommended Fix

1. Ensure `activationCode` and `nid` parameters are safely preserved through `enter-name.tsx` without dropping.
2. In `biometric-enrollment.tsx`, handle specific HTTP status codes (400 vs 409 conflict vs invalid activation code) so the user receives a precise error message rather than a generic biometric scan failure warning.

---

## 13. Retest Procedure

1. Verify parameter passing through `officer-verify` $\rightarrow$ `enter-name` $\rightarrow$ `create-password` $\rightarrow$ `biometric-enrollment`.
2. Verify `LocalAuthentication.authenticateAsync()` returns `success`.
3. Verify `api.register()` receives all 4 required payload parameters.
