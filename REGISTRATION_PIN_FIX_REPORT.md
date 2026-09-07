# NiroPay Mobile App — Registration PIN Error Audit & Fix Report

> **Document Name**: `REGISTRATION_PIN_FIX_REPORT.md`  
> **Status**: Fix Implemented — Pending Final Verification (Awaiting Supabase Reactivation)  
> **Target Screen**: `src/app/create-password.tsx`

---

## 1. Problem Reported by User

During the account registration / activation flow:
- When entering the 8-digit PIN twice (`Create PIN` and `Confirm PIN`), the screen displayed a red error banner saying:
  > ❌ **"PIN does not meet the requirements"** or **"PINs do not match"**
- This happened even when the exact same PIN (e.g. `12345678`) was entered in both fields.

---

## 2. Root Cause Analysis

Empirical audit of `create-password.tsx` and `api.ts` revealed **three underlying root causes**:

1. **Hardcoded Red Error Banner Title (Deceptive UX)**:
   - In `create-password.tsx` (lines 149–162), whenever `api.register()` failed for *any reason* (e.g., server offline, network timeout, invalid activation code, or database unreachable), `showErrorBanner` was set to `true`.
   - The title inside that red box was **hardcoded** to `{t.pinRequirementsError}` (`"PIN does not meet the requirements"`).
   - As a result, when the backend failed, the UI falsely claimed a **PIN error**, tricking the user into believing their PIN inputs didn't match.

2. **Supabase Database Paused (Backend Network Error)**:
   - Supabase free-tier database had paused due to 7 days of inactivity.
   - When Render's backend server received the `/register` request, it tried to query Supabase and threw `Auth error: [Errno -2] Name or service not known`.
   - Render returned this 500 error to the app, which triggered the hardcoded PIN error banner described in #1.

3. **Navigation Parameter Unwrapping**:
   - Navigation parameters (`username`, `nid`, `activationCode`) from `useLocalSearchParams()` could be arrays (`string[]`). Passing arrays directly to `api.register()` caused API parameter format rejections.

---

## 3. Code Modifications Implemented

### A. Dynamic Error Banner Titling ([`create-password.tsx`](file:///run/media/shaki/2472D89F72D87750/NEW/src/app/create-password.tsx))
Updated the Red Error Banner header so that when `errorMessage` is set from an API failure, the title dynamically displays `{t.registrationFailed}` (`"Registration Error"` / `"নিবন্ধন ত্রুটি"`) instead of falsely blaming the PIN.

```tsx
<Text style={[styles.errorBannerTitle, { color: theme.error }]}>
  {errorMessage ? (t.registrationFailed || 'Registration Error') : t.pinRequirementsError}
</Text>
<Text style={[styles.errorBannerSubtitle, { color: theme.error }]}>
  {errorMessage || t.ensurePinCriteria}
</Text>
```

### B. Added Localized Translation Keys ([`translations.ts`](file:///run/media/shaki/2472D89F72D87750/NEW/src/constants/translations.ts))
Added `"registrationFailed"` translation key in English (`"Registration Error"`) and Bangla (`"নিবন্ধন ত্রুটি"`).

### C. Safe Navigation Parameter Unwrapping ([`create-password.tsx`](file:///run/media/shaki/2472D89F72D87750/NEW/src/app/create-password.tsx))
Added helper `getParamStr(val)` to normalize `username`, `nid`, `activationCode`, and `bp` into clean string primitives before calling `api.register()`.

### D. Input Error Resets ([`create-password.tsx`](file:///run/media/shaki/2472D89F72D87750/NEW/src/app/create-password.tsx))
Updated `handlePasswordChange` and `handleConfirmPasswordChange` to automatically clear `errorMessage`, `showErrorBanner`, and `fieldErrors` as soon as the user resumes typing.

---

## 4. Verification & Static Type Check

- **Static Type Check**: Executed `npx tsc --noEmit` — **Passed with 0 errors**.
- **Render Keep-Alive**: Configured 10-minute cronjob on `cron-job.org` (`https://e-pay-fydp.onrender.com/user/shakib`).

---

## 5. Next Steps / Final Test Protocol

1. **Unpause / Restore Supabase**:
   - Log in to [app.supabase.com](https://app.supabase.com) and click **"Restore project"**.
2. **Execute Final End-to-End Registration Test**:
   - Launch app $\rightarrow$ Open **Verify Identity** (`officer-verify.tsx`).
   - Enter NID, Activation Code, and Bank Username.
   - Complete Biometrics enrollment (`biometric-enrollment.tsx`).
   - Enter 8-digit PIN twice in Create PIN (`create-password.tsx`) and tap **Activate and Continue**.
   - Verify smooth navigation to **Activation Success** (`activation-success.tsx`).

---
*Report generated for NiroPay Project Archive.*
