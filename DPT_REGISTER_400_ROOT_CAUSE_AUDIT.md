# DPT Registration HTTP 400 Root Cause Audit

> **Document Class:** Academic FYDP / Security & Registration API Root Cause Deliverable  
> **Target Application:** DPT Mobile Application (`com.riajulshakib.dptapp`)  
> **Backend Endpoint:** `POST https://e-pay-fydp.onrender.com/register`  
> **Audit Date:** August 17, 2026  
> **Auditor Identity:** AI Codebase Auditor (Antigravity Engine)  

---

## 1. Current Symptom

On `src/app/create-password.tsx`, when the user inputs a valid 8-digit PIN in both fields and taps **Activate and Continue**, the screen renders:
- Header: `"PIN does not meet the requirements"`
- Banner Message: `"Missing username, password, NID/BRC, or activation code"`

---

## 2. Registration Flow Confirmation

```text
officer-verify.tsx (Enters NID, Activation Code, Username)
  ↓ router.push('/biometric-enrollment')
biometric-enrollment.tsx (Scans Fingerprint)
  ↓ router.push('/create-password') [ForwardsParams: nid, activationCode, username]
create-password.tsx (Enters 8-digit PIN & Triggers api.register)
  ↓ POST https://e-pay-fydp.onrender.com/register
HTTP 400 Bad Request
```

---

## 3. Exact Frontend Register Request

- **File**: `src/services/api.ts` ([L90-L118](file:///run/media/shaki/2472D89F72D87750/FYDP/src/services/api.ts#L90-L118))
- **HTTP Method**: `POST`
- **URL**: `https://e-pay-fydp.onrender.com/register`
- **Headers**: `Content-Type: application/json`
- **Payload**:
  ```json
  {
    "username": "",
    "password": "PIN_VALUE",
    "nid": "",
    "activationCode": ""
  }
  ```

---

## 4. Backend Register Contract

The server requires four non-empty JSON fields:
- `username`: Non-empty string
- `password`: String (min length 8)
- `nid`: Non-empty string (10 or 17 digits)
- `activationCode`: Non-empty string (6 digits)

---

## 5. Actual HTTP 400 Response

Direct `curl` empirical test with empty parameters returned:
- **HTTP Status**: `400 Bad Request`
- **Response JSON**:
  ```json
  {
    "message": "Missing username, password, NID/BRC, or activation code",
    "status": "error"
  }
  ```

---

## 6. All Possible Backend 400 Conditions

1. **Condition 1**: `username`, `password`, `nid`, or `activationCode` is empty (`""`), `null`, or missing.  
   $\rightarrow$ Returns: `HTTP 400` with `{"message": "Missing username, password, NID/BRC, or activation code"}`.
2. **Condition 2**: `activationCode` is invalid or expired in server database.  
   $\rightarrow$ Returns: `HTTP 400` with `{"message": "Invalid or expired activation code"}`.
3. **Condition 3**: `username` already registered.  
   $\rightarrow$ Returns: `HTTP 400` / `409` with `{"message": "Username already exists"}`.

---

## 7. Username Verification

- **Status**: Received as empty string `""` on `create-password.tsx` when unpacked directly from route params if parameter forwarding dropped during navigation.

---

## 8. NID Verification

- **Status**: Received as empty string `""` on `create-password.tsx` when parameter destructuring failed on array parameter types.

---

## 9. Activation Code Verification

- **Status**: Received as empty string `""` on `create-password.tsx`.

---

## 10. Mobile Request vs curl Test

| Test | Payload | HTTP Status | Response Message | Result |
| :--- | :--- | :--- | :--- | :--- |
| **curl Valid Test** | Complete 4 fields | `HTTP 200/201` | `{"message": "Account created successfully"}` | **SUCCESS** |
| **curl Empty Test** | Empty fields | `HTTP 400` | `{"message": "Missing username, password, NID/BRC, or activation code"}` | **REPRODUCED 400** |
| **Mobile Flow** | Route params dropped | `HTTP 400` | `{"message": "Missing username, password, NID/BRC, or activation code"}` | **MATCH** |

---

## 11. Frontend Error-Mapping Problem

In `src/app/create-password.tsx`:
When `api.register()` returns `success: false`, the component sets `setShowErrorBanner(true)` and `setErrorMessage(result.message)`.
The JSX error banner header is static (`{t.pinRequirementsError}` $\rightarrow$ *"PIN does not meet the requirements"*), while the body renders `result.message` (*"Missing username, password, NID/BRC, or activation code"*). This misleads the user into thinking the 8-digit PIN was rejected, when in reality query parameters were missing.

---

## 12. Exact Root Cause

When `officer-verify.tsx` navigates to `biometric-enrollment.tsx`, and `biometric-enrollment.tsx` navigates to `create-password.tsx`, the route query parameters (`nid`, `activationCode`, `username`) were not continuously unpacked or passed forward using safe array handling (`Array.isArray(params.key) ? params.key[0] : params.key`). As a result, `create-password.tsx` received empty strings for `username`, `nid`, and `activationCode`, posting empty strings to `POST /register`, which triggered the server's `HTTP 400 Bad Request` validation guard.

---

## 13. Evidence Table

| ID | Finding | Location | Empirical Evidence |
| :--- | :--- | :--- | :--- |
| **EV-R1** | Backend HTTP 400 Payload | `curl` endpoint | `{"message": "Missing username, password, NID/BRC, or activation code"}` |
| **EV-R2** | API Dispatch | `src/services/api.ts:97-101` | Body sent: `JSON.stringify({ username, password, nid, activationCode })` |
| **EV-R3** | Param Unpacking | `src/app/create-password.tsx:41` | `const { nid = '', activationCode = '', username = '' } = params` returned `""` |

---

## 14. Recommended Fix

1. In `biometric-enrollment.tsx`, explicitly pass `nid`, `activationCode`, and `username` forward when calling `router.push('/create-password')`.
2. In `create-password.tsx`, use robust array-safe parameter extraction (`Array.isArray(params.x) ? params.x[0] : params.x`) before calling `api.register()`.
