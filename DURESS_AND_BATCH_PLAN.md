# Implementation Plan: Restricted Duress Mode & Concurrency-Safe Batch Payments
**Paper Specifications**: Sections IV.E & IV.F of *"Hybrid Transaction Envelopes for Secure Daily Petty-Cash Transactions with Deferred Submission, Duress, and Batch Capabilities"*

---

## 1. Executive Summary

This plan details the design and implementation of the two advanced security and scalability features from the research paper to achieve **100% full paper coverage**:
1. **Restricted Duress Mode (Section IV.E)**: An emergency coercion-defense mechanism using a secondary "Duress PIN" that exposes a bounded profile ($L_D$), silently restricts sensitive operations, and transmits covert risk signals to the bank.
2. **Concurrency-Safe Batch Payments (Section IV.F)**: A one-to-many payment architecture using a single biometric-gated ECDSA signature over a Batch Manifest $B$, atomic total debit $A_{tot} = \sum A_i$, and concurrent child settlements.

---

## 2. Feature 1: Restricted Duress Mode (Section IV.E)

### 2.1 Threat Model & Core Philosophy
Under physical coercion (robbery, hostage, or forced unlocking), an attacker demands the user open their e-wallet and transfer funds. Refusing or showing an error can cause physical harm.
- **Solution**: The user enters their pre-configured **Duress PIN** (e.g. `98765`) instead of their regular PIN (`12345`).
- The application opens normally without displaying any warning or alert to the attacker.
- It displays a constrained, plausible balance capped at a preconfigured limit ($L_D$, default: 500 BDT).
- High-risk operations (changing password/PIN, resetting biometrics, viewing full statements) are restricted or simulated.
- Real transactions can still be executed within $L_D$ so the attacker believes the transfer succeeded.
- A **silent duress telemetry flag** (`is_duress: true`) is transmitted inside the HTE envelope to the bank server for immediate security escalation and law-enforcement logging.

### 2.2 Architectural Flowchart

```
                          ┌───────────────────────────┐
                          │   User Enters 5-Digit PIN │
                          └─────────────┬─────────────┘
                                        │
                         Is it Regular PIN or Duress PIN?
                                        │
                ┌───────────────────────┴───────────────────────┐
                ▼                                               ▼
     [ Regular PIN Match ]                             [ Duress PIN Match ]
     ─────────────────────                             ────────────────────
     • Normal balance display                          • Enter Duress Mode (AuthContext.isDuress = true)
     • Full daily limit (e.g., 50,000 BDT)             • Bounded balance: min(real_balance, L_D)
     • All operations enabled                          • Strict ceiling L_D (e.g., 500 BDT)
     • Silent duress flag: false                       • High-risk actions hidden/blocked
                                                       • Silent duress flag: true ➔ Server risk alert
```

### 2.3 Proposed Changes for Duress Mode

#### Mobile App (`Main DPT/DPT`):
1. **`src/utils/security.ts`**:
   - Add `saveDuressPinHash(username, pin)` and `verifyDuressPin(username, pin)` using salted SHA-256 stored in `SecureStore` under `dpt_duress_pin_hash`.
2. **`src/context/AuthContext.tsx`**:
   - Add `isDuressMode: boolean` to auth state.
   - When unlocked via Duress PIN: set `isDuressMode = true`, clamp displayed balance to `min(balance, DURESS_LIMIT)`.
3. **`src/app/settings.tsx` & `src/app/security.tsx`**:
   - Add **"Emergency Duress PIN"** setup option where users configure their secondary 5-digit duress PIN and duress spend limit $L_D$.
4. **`src/services/crypto.ts` & `src/components/TransactionProcessingView.tsx`**:
   - When `isDuressMode` is active, include `duress: true` in the payment message $M = \{S, R, A, T, N, TxID, duress: true\}$ inside the encrypted HTE payload.

#### Backend (`e_banking/backend`):
1. **`app.py`**:
   - In `/transfer`, if decrypted message $M$ contains `duress: true`:
     - Enforce $A \le L_D$.
     - Record security audit log: `[SECURITY ALERT] Duress transaction detected for user S`.
     - Insert a hidden bank alert record in `security_events` table for automated risk review.

---

## 3. Feature 2: Concurrency-Safe Batch Payments (Section IV.F)

### 3.1 Mathematical Construction from Paper
For one-to-many payments (e.g. paying multiple employees, distributing relief, or splitting bills among group members):
$$\text{Batch Manifest: } B = \{\text{BatchID}, S, T, [(R_1, A_1, TxID_1), (R_2, A_2, TxID_2), \dots, (R_n, A_n, TxID_n)]\}$$

- **Single Authorization**: Sender approves the entire batch manifest once using the biometric gate:
  $$Sig_{batch} = \text{ECDSA-SHA256}_{SK_U^{sig}}(\text{canonical}(B))$$
- **Atomic Total Debit**: The backend computes total sum $A_{tot} = \sum_{i=1}^n A_i$ and atomically debits $A_{tot}$ from sender's balance in one single database operation.
- **Race-Free Concurrent Child Credits**: Each recipient $R_i$ receives credit under their individual $TxID_i$ concurrently without racing on the sender's balance.
- **Idempotency & Partial Failure Handling**: If an individual recipient fails (e.g. invalid account), child $TxID_i$ is marked failed and its individual amount $A_i$ is refunded back to the sender.

### 3.2 Proposed Changes for Batch Payments

#### Mobile App (`Main DPT/DPT`):
1. **New Screen: `src/app/batch-transfer.tsx`**:
   - Dynamic recipient list builder: add recipient rows $[(R_i, A_i)]$.
   - Live total counter displaying $A_{tot} = \sum A_i$.
   - Single biometric confirmation modal.
2. **`src/services/crypto.ts`**:
   - Implement `createBatchPaymentEnvelope()`:
     - Generates `BatchID` and child $TxID_i$.
     - Encrypts batch manifest $B$ with HTE AES-256-GCM under key $K_T$.
     - Signs manifest with device P-256 ECDSA key.
3. **`src/services/api.ts`**:
   - Add `transferBatch(batchEnvelope)` calling `POST /transfer-batch`.

#### Backend (`e_banking/backend`):
1. **`app.py`**:
   - Add `POST /transfer-batch` endpoint:
     1. Verify biometric ECDSA signature over the batch manifest.
     2. Decrypt batch manifest using derived HTE session key.
     3. Compute $A_{tot} = \sum A_i$. Check sender balance $\ge A_{tot}$.
     4. **Atomic Debit**: Debit $A_{tot}$ from sender in a single database operation.
     5. **Concurrent Child Settlement**: Loop over children $[(R_i, A_i, TxID_i)]$, credit valid receivers, record idempotent transactions.
     6. **Partial Refund**: If any child fails, credit unspent amount back to sender balance.
     7. Return detailed batch receipt with individual statuses.

---

## 4. File Modification Matrix

| File Path | Component | New / Modified Capability |
| :--- | :--- | :--- |
| `src/utils/security.ts` | Mobile App | Add Duress PIN hashing, verification, and SecureStore storage |
| `src/context/AuthContext.tsx` | Mobile App | Add `isDuressMode`, balance masking, and duress session tracking |
| `src/app/security.tsx` | Mobile App | Add UI to configure Duress PIN and maximum limit $L_D$ |
| `src/app/batch-transfer.tsx` | Mobile App | New screen for multi-recipient 1-to-many payments |
| `src/services/crypto.ts` | Mobile App | Batch manifest construction, duress flag integration, HTE batch signing |
| `src/services/api.ts` | Mobile App | Add `/transfer-batch` API client method |
| `backend/app.py` | Python Backend | Implement `/transfer-batch` endpoint & duress risk event listener |
| `PROJECT_DOCUMENTATION.md` | Documentation | Update documentation with Sections 21 & 22 |

---

## 5. Verification Plan

1. **Duress Mode Testing**:
   - Setup Duress PIN in Security settings (`98765`).
   - Unlock app using `98765`: verify balance is capped at $L_D$ (e.g. 500 BDT).
   - Execute transfer: verify backend logs `[SECURITY ALERT] Duress transaction`.
   - Unlock with normal PIN: verify full real balance is intact.
2. **Batch Payment Testing**:
   - Create a batch of 3 recipients (e.g. 100 BDT to user A, 200 BDT to user B, 50 BDT to user C).
   - Confirm with single biometric prompt.
   - Verify sender is debited exactly 350 BDT in a single atomic transaction.
   - Verify each recipient receives their exact amount with individual $TxID$.
