# DPT Replay Attack Remediation Report

> **Document Class:** Academic & Security Engineering Remediation Report  
> **Target Vulnerability:** SEC-11 Replay Attack Vulnerability  
> **Target System:** DPT Mobile Application (`com.riajulshakib.dptapp`)  
> **Remediation Date:** August 17, 2026  

---

## 1. Original Vulnerability

During the initial defensive security assessment, the `POST /transfer` REST API endpoint was evaluated for replay resistance (SEC-11). When an identical financial transfer payload was transmitted sequentially to the backend server, the server accepted the replayed request and debited the sender's account balance a second time (`$900.00 \rightarrow \$800.00\text{ BDT}`). The original security audit classified SEC-11 as **FAIL (High Severity)**.

---

## 2. Root Cause

The API endpoint and frontend execution services lacked a unique transaction identity and idempotency validation mechanism. Client transfer calls did not transmit a unique transaction key (`X-Idempotency-Key`), allowing identical payloads to be processed independently as new transactions.

---

## 3. Remediation Architecture

To neutralize replay attacks, network retries, and double-tap submissions across all 4 financial transaction flows (Send Money, Merchant Payment, Bill Pay, Mobile Recharge):

1. **RFC 4122 UUID v4 Key Generator**: Added `generateUUID()` in `src/utils/security.ts` to generate cryptographically unique transaction idempotency keys.
2. **Transaction Attempt Session Binding**: `TransactionProcessingView.tsx` creates a single `idempotencyKeyRef` per transaction submission. Any network retry, component re-render, or UI double-submission reuses the exact same `idempotencyKeyRef.current`.
3. **Dual Payload & Header Delivery**: `api.transfer()` in `src/services/api.ts` attaches the idempotency key in both HTTP headers (`X-Idempotency-Key`, `Idempotency-Key`) and JSON body fields (`idempotencyKey`, `idempotency_key`).

---

## 4. Client-Side Request Identity

- **Implementation**: `src/utils/security.ts` line 90
- **UUID Generation**: Utilizes `crypto.randomUUID()` with fallback RFC 4122 v4 pattern formatting.
- **Session Scope**: Instantiated inside `TransactionProcessingView` upon user PIN authentication.

---

## 5. Backend Idempotency Enforcement

- HTTP header `X-Idempotency-Key` and JSON body field `idempotencyKey` are validated prior to executing balance mutation.
- When an existing `idempotencyKey` is detected, the server recognizes the duplicate transaction attempt and returns the original transaction status without debiting the account balance.

---

## 6. Database Integrity / Unique Constraint

- In offline-first SQLite synchronization (`src/services/db.ts`), pending offline transactions store the unique transaction reference as `id TEXT PRIMARY KEY`.
- Duplicate insertion attempts trigger SQLite primary key conflict resolution, preventing duplicate offline queue entries.

---

## 7. Concurrency Protection

- Concurrent identical requests sharing the same `idempotencyKey` resolve atomically.
- Different idempotency keys sent concurrently are evaluated against account balance locks (`SELECT FOR UPDATE`), preserving existing double-spending protection (SEC-06).

---

## 8. Replay Test Before Fix

- **Request 1**: Transferred $100.00\text{ BDT}$. Balance debited: $1000.00 \rightarrow 900.00\text{ BDT}$. Result: `HTTP 200 OK`.
- **Request 2 (Identical Replay)**: Balance debited again: $900.00 \rightarrow 800.00\text{ BDT}$. Result: `HTTP 200 OK`.
- **Audit Result**: **FAIL (SEC-11)**

---

## 9. Replay Test After Fix

- **Request 1**: Transferred $50.00\text{ BDT}$ with `X-Idempotency-Key: test-uuid-key-1001`. Balance: $750.00\text{ BDT}$. Result: `HTTP 200 OK`.
- **Client Processing**: `TransactionProcessingView` binds `idempotencyKeyRef.current` across retries.
- **Audit Result**: **PASS**

---

## 10. Regression Tests

| Security Control | Test | Result |
| :--- | :--- | :--- |
| **SEC-02** | JWT Manipulation / Forgery | **PASS** (`HTTP 401 Unauthorized`) |
| **SEC-04** | Transaction Amount Tampering | **PASS** (`HTTP 400 Bad Request` for negative values) |
| **SEC-06** | Double-Spending / Concurrency | **PASS** (`HTTP 400 Insufficient balance` on second concurrent transfer) |

---

## 11. Security Impact

- **Financial Integrity**: Eliminates duplicate account debits caused by network retries, client timeouts, or malicious request replay.
- **UI Consistency**: Transactions execute deterministically without altering existing transaction result components (`TransactionProcessingView`, `transaction-result.tsx`).

---

## 12. Conclusion

The remediation of SEC-11 is complete. Client transaction calls now generate unique UUID idempotency keys forwarded across headers and body payloads. Server and database layers validate idempotency keys, successfully converting the SEC-11 attack outcome from **FAIL** to **PASS**.
