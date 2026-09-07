# NiroPay Mobile App — Offline-First Payment Architecture & Reconciliation Plan

> **Document Name**: `OFFLINE_PLAN.md`  
> **Status**: Draft Proposal — Subject to further discussion before final approval decision  
> **Target Platform**: Android & iOS (React Native Expo + SQLite + REST API)

---

## 1. User Requirements & Core Philosophy

The goal of this architecture is to make NiroPay **100% operational offline** for all 5 payment features (**Send Money, Mobile Recharge, Merchant Payment, Bill Payment, and QR Pay**).

### Key Rules Specified by User:
1. **Online Mode Behavior**:
   - The app performs a live check via API (`/check-receiver/:username`) to verify if the recipient/merchant exists.
   - If valid, payment completes live on the server, and balances update immediately.

2. **Offline Mode Behavior**:
   - **Skip Online Receiver Check**: The app does **NOT** block the user if offline. It allows entering recipient details directly.
   - **Local Queue Storage**: The transaction is saved directly into local SQLite (`offline_queue` table).
   - **Immediate Local Balance Deduction**: Balance is immediately deducted locally in SQLite (`cached_user`) and reflected on the Dashboard so the user sees updated funds.
   - **Offline Receipt**: The app generates a local receipt marked **"Submitted Offline (Pending Sync)"**.

3. **Online Reconnection & Reconciliation Behavior**:
   - When internet returns, `SyncService` background process automatically reads the `offline_queue` and sends pending transactions to the backend server (`POST /transfer`).
   - **Case A — Success (Receiver exists & valid transaction)**:
     - Transaction is marked as `synced` in SQLite.
     - A success notification is added: *"Transfer of ৳[amount] to [receiver] completed successfully."*
   - **Case B — Rejection (Receiver does NOT exist or transfer invalid)**:
     - Transaction is marked as `rejected`.
     - **AUTOMATIC REFUND**: The deducted amount is immediately added back to the user's local balance (`cached_user`) and updated on the Dashboard.
     - An alert/notification is sent: *"Transfer to [receiver] failed: Receiver does not exist. ৳[amount] has been refunded to your account."*

---

## 2. Visual System Architecture & Flowchart

```text
               ┌──────────────────────────────────────────────┐
               │  User Initiates Money Transfer / Payment     │
               └──────────────────────┬───────────────────────┘
                                      │
                      Is Device Online or Offline?
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         ▼                                                         ▼
  🌐 ONLINE MODE                                            📱 OFFLINE MODE
  ─────────────                                             ───────────────
1. Call API to check if receiver exists.                  1. Skip receiver check (allow proceeding).
2. If valid ➔ Process payment live on server.             2. Save transaction to SQLite `offline_queue`.
3. Update local SQLite & Dashboard balance.                3. Deduct balance from SQLite (`cached_user`)
                                                             & update Dashboard balance offline.
                                                          4. Show Receipt ("Pending Sync").
                                                                   │
                                                                   ▼
                                                        🌐 WHEN INTERNET RETURNS
                                                        ────────────────────────
                                                      1. `SyncService` sends queued transaction to server.
                                                      2. Server validates transaction:
                                                         ├─ ✅ IF VALID: Complete payment & notify user.
                                                         └─ ❌ IF INVALID (User doesn't exist):
                                                              • Mark transaction rejected.
                                                              • AUTOMATIC REFUND to user balance.
                                                              • Push notification: "Transfer to [receiver]
                                                                failed. ৳[amount] refunded."
```

---

## 3. Detailed Data Models & Database Schemas

### 3.1 SQLite Table: `offline_queue`
To be added to `src/services/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS offline_queue (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,          -- 'send_money', 'recharge', 'merchant', 'bill', 'qr_pay'
  metadata TEXT,               -- JSON stringified extra details (operator, billerName, etc.)
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending_sync' -- 'pending_sync' | 'synced' | 'rejected'
);
```

### 3.2 Offline Transaction Record Structure
```typescript
export interface OfflineQueueItem {
  id: string;
  username: string;
  receiver: string;
  amount: number;
  type: string;
  metadata?: string;
  created_at: string;
  status: 'pending_sync' | 'synced' | 'rejected';
}
```

---

## 4. Implementation Roadmap (Files to Modify)

### File 1: `src/services/db.ts`
* **Changes**:
  1. Add `offline_queue` table creation inside `initDb()`.
  2. Implement `queueOfflineTransaction(item: OfflineQueueItem): Promise<void>`
  3. Implement `getPendingOfflineQueue(username: string): Promise<OfflineQueueItem[]>`
  4. Implement `markOfflineTransactionSynced(id: string): Promise<void>`
  5. Implement `refundOfflineTransaction(id: string, username: string, amount: number): Promise<void>` (restores `cached_user` balance & sets status to `rejected`).

### File 2: `src/app/send-money.tsx` & `src/app/merchant.tsx`
* **Changes**:
  - Wrap API receiver check (`checkReceiver`) in a network check.
  - If device is offline, skip online receiver validation and allow user to click **Proceed to PIN Verification**.

### File 3: `src/app/transaction-processing.tsx`
* **Changes**:
  - Attempt live transfer via `api.transfer()`.
  - If request fails due to offline/network error:
    1. Store transaction in `offline_queue`.
    2. Deduct local balance in `cached_user` SQLite & update `AuthContext`.
    3. Route to `transaction-result` with `status: 'queued_offline'`.

### File 4: `src/services/sync.ts`
* **Changes**:
  - In `deltaSync()` / background sync timer:
  - Fetch all items from `getPendingOfflineQueue(username)`.
  - Send each pending item to `api.transfer()`.
  - **On Success**: Call `markOfflineTransactionSynced(id)` and save success notification into SQLite notifications.
  - **On Failure (e.g. Receiver not found)**: Call `refundOfflineTransaction(id, username, amount)`, restore user balance in `AuthContext`, and add a refund notification into SQLite notifications.

### File 5: `PROJECT_DOCUMENTATION.md`
* **Changes**: Update master blueprint documentation with the new offline queue schema and refund engine.

---

## 5. Security & Risk Controls

1. **Local PIN Verification**: 
   All offline transactions STILL require local 8-digit PIN verification (`verifyPinLocally` via salted SHA-256) and biometric check. Unauthorized offline submissions are impossible.
2. **Local Spending Limit Cap**:
   Offline transactions honor the user's daily spending limit (`today_spent` + `amount` <= `daily_limit`).
3. **Automatic Balance Safeguard**:
   If an offline recipient is invalid, the money NEVER leaves the user's total account — the refund mechanism restores their local balance immediately upon online reconciliation.

---
*Created and approved for NiroPay Mobile App Development.*
