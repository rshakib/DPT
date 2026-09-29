import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Paper §4.1: queued envelopes are kept in platform secure storage (keystore-backed),
// never as plaintext in SQLite. Telemetry rows in SQLite hold only metadata.
const PENDING_ENV_PREFIX = 'dpt_pending_env_';
const PENDING_META_PREFIX = 'dpt_pending_meta_';
const QUEUE_SEQ_PREFIX = 'dpt_queue_seq_';

/** Exponential backoff schedule for deferred submission (paper §4.1). */
function backoffMsFor(retryCount: number): number {
  const base = Math.min(Math.pow(2, Math.max(0, retryCount)) * 1000, 5 * 60 * 1000);
  return base;
}

// Serialize ALL SQLite access on one in-process queue. Concurrent writers
// (15s sync + screens + subscribers) otherwise race and throw
// "database is locked" from NativeStatement.finalizeAsync.
let _dbLock: Promise<unknown> = Promise.resolve();
let _dbLockDepth = 0;

export function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  // Re-entrant: calls made *inside* a locked operation (e.g. statements inside
  // withTransactionAsync) must not deadlock.
  if (_dbLockDepth > 0) return fn();
  const run = _dbLock.then(async () => {
    _dbLockDepth++;
    try {
      return await fn();
    } finally {
      _dbLockDepth--;
    }
  });
  _dbLock = run.then(() => undefined, () => undefined);
  return run;
}

/** Monotonic device-local queue sequence number seq_i (distinct from TxID). */
async function getNextQueueSeq(username: string): Promise<number> {
  const key = `${QUEUE_SEQ_PREFIX}${username}`;
  try {
    const raw = await SecureStore.getItemAsync(key);
    const next = (raw ? parseInt(raw, 10) : 0) + 1;
    await SecureStore.setItemAsync(key, String(next));
    return next;
  } catch {
    return 0;
  }
}

function toEpoch(dateStr: any): number {
  if (!dateStr) return 0;
  try {
    const str = String(dateStr).replace('Z', '+00:00');
    const dt = new Date(str);
    const time = dt.getTime();
    return isNaN(time) ? 0 : time;
  } catch {
    return 0;
  }
}

// IDs that are generated on-device and never originate from the server.
// A full cache refresh must keep them (the server has never seen them) and they
// can only be reconciled once the matching canonical server row arrives.
const LOCAL_ONLY_ID_PREFIXES = ['OFF-', 'FAIL-', 'SRV-', 'NFC-', 'PENALTY-', 'LOCAL-RECV-'];

function isLocalOnlyId(id: unknown): boolean {
  if (id === null || id === undefined) return false;
  const str = String(id);
  return LOCAL_ONLY_ID_PREFIXES.some((prefix) => str.startsWith(prefix));
}

// Only these local placeholders are dropped once the server returns the canonical
// row. Outgoing queue rows (OFF-) are excluded on purpose: they are removed by the
// sync flush on settlement, and hiding them here could mask a genuinely new
// transfer of the same amount to the same receiver.
const SUPERSEDABLE_LOCAL_PREFIXES = ['OFF-REC-', 'LOCAL-RECV-'];

function isSupersedableLocalId(id: unknown): boolean {
  if (id === null || id === undefined) return false;
  const str = String(id);
  return SUPERSEDABLE_LOCAL_PREFIXES.some((prefix) => str.startsWith(prefix));
}

const LOCAL_ONLY_WHERE = LOCAL_ONLY_ID_PREFIXES.map((p) => `id LIKE '${p}%'`).join(' OR ');

const SUPERSEDE_WINDOW_MS = 24 * 60 * 60 * 1000;

function txSignature(tx: any): string {
  const amount = Number(tx.amount || 0).toFixed(2);
  const sender = String(tx.sender_username || tx.sender || '').toLowerCase();
  const receiver = String(tx.receiver_username || tx.receiver || '').toLowerCase();
  return `${sender}>${receiver}@${amount}`;
}

/**
 * Hide on-device received-credit placeholders (offline NFC / QR receipts) once the
 * server has returned the canonical transaction for the same transfer. Without
 * this, the placeholder and its server counterpart both appear in Recent Activity
 * / History as duplicates.
 */
function dropSupersededLocalRows(rows: any[]): any[] {
  const candidates = rows.filter((r) => isSupersedableLocalId(r.id));
  if (candidates.length === 0) return rows;

  const serverRows = rows.filter((r) => !isLocalOnlyId(r.id));
  if (serverRows.length === 0) return rows;

  return rows.filter((row) => {
    if (!isSupersedableLocalId(row.id)) return true;

    return !serverRows.some((server) => {
      if (txSignature(server) !== txSignature(row)) return false;
      const rowTime = toEpoch(row.created_at || row.createdAt || row.timestamp);
      const serverTime = toEpoch(server.created_at || server.createdAt || server.timestamp);
      if (rowTime === 0 || serverTime === 0) return true;
      return Math.abs(serverTime - rowTime) <= SUPERSEDE_WINDOW_MS;
    });
  });
}

/**
 * Ensures the SQLite database is opened and schema initialized.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('niropay.db');
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA busy_timeout = 5000;
          CREATE TABLE IF NOT EXISTS cached_user (
            username TEXT PRIMARY KEY,
            balance REAL,
            daily_limit REAL,
            today_spent REAL,
            updated_at TEXT,
            raw_json TEXT
          );
          CREATE TABLE IF NOT EXISTS cached_transactions (
            id TEXT PRIMARY KEY,
            username TEXT,
            amount REAL,
            status TEXT,
            type TEXT,
            counterparty TEXT,
            created_at TEXT,
            created_at_epoch INTEGER,
            reference TEXT,
            raw_json TEXT
          );
          CREATE TABLE IF NOT EXISTS cached_notifications (
            id TEXT PRIMARY KEY,
            username TEXT,
            title TEXT,
            message TEXT,
            notification_type TEXT,
            is_read INTEGER,
            created_at TEXT,
            created_at_epoch INTEGER,
            raw_json TEXT
          );
          CREATE TABLE IF NOT EXISTS pending_offline_transactions (
            id TEXT PRIMARY KEY,
            username TEXT,
            receiver TEXT,
            amount REAL,
            type TEXT,
            created_at TEXT,
            created_at_epoch INTEGER,
            status TEXT,
            raw_json TEXT
          );
          CREATE TABLE IF NOT EXISTS user_settings (
            username TEXT PRIMARY KEY,
            profile_image TEXT,
            display_name TEXT
          );
          CREATE TABLE IF NOT EXISTS used_qr_nonces (
            nonce TEXT PRIMARY KEY,
            scanned_at_epoch INTEGER,
            sender TEXT,
            receiver TEXT
          );
        `);

        // Schema migrations for existing tables
        try {
          await db.execAsync(`ALTER TABLE cached_transactions ADD COLUMN created_at_epoch INTEGER;`);
        } catch (e) {}
        try {
          await db.execAsync(`ALTER TABLE cached_notifications ADD COLUMN created_at_epoch INTEGER;`);
        } catch (e) {}
        try {
          await db.execAsync(`ALTER TABLE cached_notifications ADD COLUMN username TEXT;`);
        } catch (e) {}
        try {
          await db.execAsync(`ALTER TABLE user_settings ADD COLUMN display_name TEXT;`);
        } catch (e) {}
        try {
          await db.execAsync(`ALTER TABLE pending_offline_transactions ADD COLUMN seq INTEGER;`);
        } catch (e) {}
        try {
          await db.execAsync(`ALTER TABLE pending_offline_transactions ADD COLUMN next_attempt_at INTEGER;`);
        } catch (e) {}

        // Serialize every DB operation to prevent "database is locked".
        const origRun = db.runAsync.bind(db);
        const origExec = db.execAsync.bind(db);
        const origAll = db.getAllAsync.bind(db);
        const origFirst = db.getFirstAsync.bind(db);
        const origTx = db.withTransactionAsync.bind(db);
        (db as any).runAsync = (...a: any[]) => withDbLock(() => (origRun as any)(...a));
        (db as any).execAsync = (...a: any[]) => withDbLock(() => (origExec as any)(...a));
        (db as any).getAllAsync = (...a: any[]) => withDbLock(() => (origAll as any)(...a));
        (db as any).getFirstAsync = (...a: any[]) => withDbLock(() => (origFirst as any)(...a));
        (db as any).withTransactionAsync = (fn: any) => withDbLock(() => origTx(fn));

        return db;
      } catch (err) {
        console.warn('Failed to initialize SQLite database:', err);
        dbPromise = null;
        throw err;
      }
    })();
  }
  return dbPromise;
}

/**
 * Retrieve cached user details for a given username.
 */
export async function getCachedUser(username: string): Promise<any | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ raw_json: string }>(
      'SELECT raw_json FROM cached_user WHERE username = ?',
      [username]
    );
    if (row && row.raw_json) {
      return JSON.parse(row.raw_json);
    }
  } catch (error) {
    console.warn('Failed to get cached user:', error);
  }
  return null;
}

/**
 * Persist user details into SQLite cache.
 */
export async function saveCachedUser(username: string, userData: any): Promise<void> {
  try {
    const db = await getDb();
    const rawJson = JSON.stringify(userData);
    const balance = userData.balance ?? 0;
    const dailyLimit = userData.daily_limit ?? userData.dailyLimit ?? 0;
    const todaySpent = userData.today_spent ?? userData.todaySpent ?? 0;
    const updatedAt = new Date().toISOString();

    await db.runAsync(
      `INSERT OR REPLACE INTO cached_user (username, balance, daily_limit, today_spent, updated_at, raw_json) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, balance, dailyLimit, todaySpent, updatedAt, rawJson]
    );
  } catch (error: any) {
    console.warn('Failed to save cached user:', error);
  }
}

/**
 * Calculate the total amount spent strictly TODAY (since midnight 00:00:00 local time)
 * for outgoing debits/transfers from cached transactions.
 */
export async function getTodaySpent(username: string): Promise<number> {
  try {
    const db = await getDb();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfDayEpoch = startOfDay.getTime();

    const row = await db.getFirstAsync<{ today_total: number | null }>(
      `SELECT SUM(amount) as today_total FROM cached_transactions 
       WHERE username = ? 
       AND created_at_epoch >= ? 
       AND status = 'success'
       AND (type = 'transfer' OR type = 'user_transfer' OR type = 'send_money' OR type = 'merchant_payment' OR type = 'mobile_recharge' OR type = 'bill_payment' OR type = 'cashout' OR type = 'cash_out' OR type = 'qr_payment' OR type = 'nfc_transfer')`,
      [username, startOfDayEpoch]
    );

    return row?.today_total ? Number(row.today_total) : 0;
  } catch (error) {
    console.warn('Failed to calculate today spent from SQLite:', error);
    return 0;
  }
}

/**
 * Retrieve cached transaction history for a given username, sorted numerically by epoch.
 */
export async function getCachedTransactions(username: string): Promise<any[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; raw_json: string }>(
      'SELECT id, raw_json FROM cached_transactions WHERE username = ? ORDER BY created_at_epoch DESC',
      [username]
    );
    const parsedRows = rows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.raw_json);
      } catch {
        parsed = {};
      }
      // The raw server payload may omit an id (or use a different field name).
      // Fall back to the SQLite primary key so React list keys stay stable across
      // syncs instead of being regenerated on every read.
      return { ...parsed, id: r.id ?? parsed.id };
    });
    return dropSupersededLocalRows(parsedRows);
  } catch (error) {
    console.warn('Failed to get cached transactions:', error);
    return [];
  }
}

/**
 * Persist transaction list into SQLite cache for a given username.
 */
export async function saveCachedTransactions(username: string, transactions: any[]): Promise<void> {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      // Only replace rows that actually came from the server. Locally-generated
      // rows (offline queue / forfeitures / service placeholders) must survive a
      // full refresh or they vanish from Recent Activity & History on every login.
      await db.runAsync(
        `DELETE FROM cached_transactions WHERE username = ? AND NOT (${LOCAL_ONLY_WHERE})`,
        [username]
      );
      for (const tx of transactions) {
        const id = String(tx.id || tx.reference || tx.referenceNo || Math.random());
        const amount = Number(tx.amount || 0);
        const status = String(tx.status || 'success');
        const type = String(tx.type || 'transfer');
        const counterparty = String(tx.counterparty || tx.receiver || tx.sender || '');
        const createdAt = String(tx.created_at || tx.createdAt || tx.date || new Date().toISOString());
        const createdAtEpoch = toEpoch(createdAt);
        const reference = String(tx.reference || tx.referenceNo || id);
        const rawJson = JSON.stringify(tx);

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_transactions (id, username, amount, status, type, counterparty, created_at, created_at_epoch, reference, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, username, amount, status, type, counterparty, createdAt, createdAtEpoch, reference, rawJson]
        );
      }
    });
  } catch (error: any) {
    console.warn('Failed to save cached transactions:', error);
  }
}

/**
 * Retrieve cached notifications for a given username, sorted numerically by epoch.
 */
export async function getCachedNotifications(username: string): Promise<any[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; raw_json: string }>(
      'SELECT id, raw_json FROM cached_notifications WHERE username = ? ORDER BY created_at_epoch DESC',
      [username]
    );
    return rows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.raw_json);
      } catch {
        parsed = {};
      }
      // Without this, notifications lacking a server-side id get a fresh
      // Math.random() id on every read — which both breaks the "mark as read"
      // persistence (the stored id never matches again) and forces React to
      // remount every row on each 15s sync.
      return { ...parsed, id: r.id ?? parsed.id };
    });
  } catch (error) {
    console.warn('Failed to get cached notifications:', error);
    return [];
  }
}

/**
 * Persist notifications into SQLite cache for a given username.
 */
export async function saveCachedNotifications(username: string, notifications: any[]): Promise<void> {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cached_notifications WHERE username = ?', [username]);
      for (const notif of notifications) {
        const id = String(notif.id || Math.random());
        const title = String(notif.title || '');
        const message = String(notif.message || notif.body || '');
        const notifType = String(notif.notification_type || notif.type || 'general');
        const isRead = notif.is_read ? 1 : 0;
        const createdAt = String(notif.created_at || notif.createdAt || new Date().toISOString());
        const createdAtEpoch = toEpoch(createdAt);
        const rawJson = JSON.stringify(notif);

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_notifications (id, username, title, message, notification_type, is_read, created_at, created_at_epoch, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, username, title, message, notifType, isRead, createdAt, createdAtEpoch, rawJson]
        );
      }
    });
  } catch (error: any) {
    console.warn('Failed to save cached notifications:', error);
  }
}

/**
 * Retrieve the latest (MAX epoch) timestamp for cached transactions of a given user.
 */
export async function getLatestCachedTransactionTimestamp(username: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ max_epoch: number }>(
      'SELECT MAX(created_at_epoch) as max_epoch FROM cached_transactions WHERE username = ?',
      [username]
    );
    if (row && row.max_epoch && row.max_epoch > 0) {
      return new Date(row.max_epoch).toISOString();
    }
  } catch (error) {
    console.warn('Failed to get latest cached transaction timestamp:', error);
  }
  return null;
}

/**
 * Incrementally merge new/updated transactions into the existing SQLite cache.
 */
export async function mergeCachedTransactions(username: string, newTransactions: any[]): Promise<void> {
  if (!newTransactions || newTransactions.length === 0) return;
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const tx of newTransactions) {
        const id = String(tx.id || tx.reference || tx.referenceNo || Math.random());
        const amount = Number(tx.amount || 0);
        const status = String(tx.status || 'success');
        const type = String(tx.type || 'transfer');
        const counterparty = String(tx.counterparty || tx.receiver || tx.sender || '');
        const createdAt = String(tx.created_at || tx.createdAt || tx.date || new Date().toISOString());
        const createdAtEpoch = toEpoch(createdAt);
        const reference = String(tx.reference || tx.referenceNo || id);
        const rawJson = JSON.stringify(tx);

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_transactions (id, username, amount, status, type, counterparty, created_at, created_at_epoch, reference, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, username, amount, status, type, counterparty, createdAt, createdAtEpoch, reference, rawJson]
        );
      }
    });
  } catch (error: any) {
    console.warn('Failed to merge cached transactions:', error);
  }
}

/**
 * Retrieve the latest (MAX epoch) timestamp for cached notifications of a given user.
 */
export async function getLatestCachedNotificationTimestamp(username: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ max_epoch: number }>(
      'SELECT MAX(created_at_epoch) as max_epoch FROM cached_notifications WHERE username = ?',
      [username]
    );
    if (row && row.max_epoch && row.max_epoch > 0) {
      return new Date(row.max_epoch).toISOString();
    }
  } catch (error) {
    console.warn('Failed to get latest cached notification timestamp:', error);
  }
  return null;
}

/**
 * Incrementally merge new/updated notifications into the existing SQLite cache.
 */
export async function mergeCachedNotifications(username: string, newNotifications: any[]): Promise<void> {
  if (!newNotifications || newNotifications.length === 0) return;
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const notif of newNotifications) {
        const id = String(notif.id || Math.random());
        const title = String(notif.title || '');
        const message = String(notif.message || notif.body || '');
        const notifType = String(notif.notification_type || notif.type || 'general');
        const isRead = notif.is_read ? 1 : 0;
        const createdAt = String(notif.created_at || notif.createdAt || new Date().toISOString());
        const createdAtEpoch = toEpoch(createdAt);
        const rawJson = JSON.stringify(notif);

        await db.runAsync(
          `INSERT OR REPLACE INTO cached_notifications (id, username, title, message, notification_type, is_read, created_at, created_at_epoch, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, username, title, message, notifType, isRead, createdAt, createdAtEpoch, rawJson]
        );
      }
    });
  } catch (error: any) {
    console.warn('Failed to merge cached notifications:', error);
  }
}

/**
 * Clear cached data for a specific user on logout.
 */
export async function clearUserCache(username: string): Promise<void> {
  try {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM cached_user WHERE username = ?', [username]);
      await db.runAsync('DELETE FROM cached_transactions WHERE username = ?', [username]);
      await db.runAsync('DELETE FROM cached_notifications WHERE username = ?', [username]);
      await db.runAsync('DELETE FROM pending_offline_transactions WHERE username = ?', [username]);
    });
  } catch (error: any) {
    console.warn('Failed to clear user cache:', error);
  }
}

/**
 * Queue an offline transaction in SQLite to be settled once internet connectivity is restored.
 */
export async function savePendingOfflineTransaction(
  username: string,
  receiver: string,
  amount: number,
  type: string,
  reference: string,
  options?: { nonRefundable?: boolean; retryCount?: number; envelope?: any }
): Promise<void> {
  try {
    const db = await getDb();
    const createdAt = new Date().toISOString();
    const createdAtEpoch = Date.now();
    const retryCount = options?.retryCount || 0;
    const seq = await getNextQueueSeq(username);

    // Keep the signed envelope P in platform secure storage (keystore-backed),
    // not in plaintext SQLite (paper §4.1 local queue protection).
    const envelopeJson = options?.envelope ? JSON.stringify(options.envelope) : null;
    if (envelopeJson) {
      try {
        await SecureStore.setItemAsync(`${PENDING_ENV_PREFIX}${reference}`, envelopeJson);
      } catch (e) {
        console.warn('Failed to secure-store pending envelope:', e);
      }
    }

    // Sensitive fields (receiver, amount) go to keystore-backed storage, never
    // plaintext SQLite (paper §4.1 local queue protection). SQLite keeps only the
    // routing/retry metadata needed for ordering and settlement.
    const meta = {
      id: reference,
      username,
      receiver,
      amount,
      type,
      reference,
      createdAt,
      retryCount,
      seq,
      nextAttemptAt: 0,
      hasEnvelope: !!envelopeJson,
    };
    try {
      await SecureStore.setItemAsync(`${PENDING_META_PREFIX}${reference}`, JSON.stringify(meta));
    } catch (e) {
      console.warn('Failed to secure-store pending queue metadata:', e);
    }

    const rowMeta = {
      id: reference,
      username,
      type,
      reference,
      createdAt,
      retryCount,
      seq,
      nextAttemptAt: 0,
      hasEnvelope: !!envelopeJson,
    };

    await db.runAsync(
      `INSERT OR REPLACE INTO pending_offline_transactions (id, username, receiver, amount, type, created_at, created_at_epoch, status, raw_json, seq, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, username, '', 0, type, createdAt, createdAtEpoch, 'pending', JSON.stringify(rowMeta), seq, 0]
    );
  } catch (error) {
    console.warn('Failed to save pending offline transaction:', error);
  }
}

/**
 * Update retry count for a pending offline transaction.
 */
export async function updatePendingOfflineTransactionRetry(id: string, retryCount: number): Promise<void> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ raw_json: string }>(
      'SELECT raw_json FROM pending_offline_transactions WHERE id = ?',
      [id]
    );
    if (row && row.raw_json) {
      const parsed = JSON.parse(row.raw_json);
      parsed.retryCount = retryCount;
      // Exponential backoff: earliest time this item may be resubmitted (paper §4.1).
      const nextAttemptAt = Date.now() + backoffMsFor(retryCount);
      parsed.nextAttemptAt = nextAttemptAt;
      await db.runAsync(
        'UPDATE pending_offline_transactions SET raw_json = ?, next_attempt_at = ? WHERE id = ?',
        [JSON.stringify(parsed), nextAttemptAt, id]
      );
      // Keep the keystore-backed meta in sync (nextAttemptAt/retryCount live there).
      try {
        const metaRaw = await SecureStore.getItemAsync(`${PENDING_META_PREFIX}${id}`);
        const meta = metaRaw ? JSON.parse(metaRaw) : {};
        meta.retryCount = retryCount;
        meta.nextAttemptAt = nextAttemptAt;
        await SecureStore.setItemAsync(`${PENDING_META_PREFIX}${id}`, JSON.stringify(meta));
      } catch (e) {}
    }
  } catch (error) {
    console.warn('Failed to update pending offline transaction retry:', error);
  }
}

/**
 * Retrieve all pending offline transactions for a user.
 */
export async function getPendingOfflineTransactions(username: string): Promise<any[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; raw_json: string }>(
      'SELECT id, raw_json FROM pending_offline_transactions WHERE username = ? ORDER BY created_at_epoch ASC',
      [username]
    );
    const items: any[] = [];
    for (const r of rows) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.raw_json);
      } catch {
        parsed = {};
      }
      // Rehydrate sensitive fields (receiver/amount) from keystore-backed storage.
      const metaRaw = await SecureStore.getItemAsync(`${PENDING_META_PREFIX}${r.id}`).catch(() => null);
      if (metaRaw) {
        try {
          Object.assign(parsed, JSON.parse(metaRaw));
        } catch {}
      }
      // Rehydrate the signed envelope P from keystore-backed storage.
      const envRaw = await SecureStore.getItemAsync(`${PENDING_ENV_PREFIX}${r.id}`).catch(() => null);
      if (envRaw) {
        try {
          parsed.envelope = JSON.parse(envRaw);
        } catch {}
      }
      items.push(parsed);
    }
    return items;
  } catch (error) {
    console.warn('Failed to retrieve pending offline transactions:', error);
    return [];
  }
}

/**
 * Detect gaps/corruption in the device-local queue sequence seq_i (paper §4.1).
 * Returns the missing sequence numbers, if any.
 */
export async function checkQueueIntegrity(username: string): Promise<{ ok: boolean; gaps: number[] }> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ seq: number | null }>(
      'SELECT seq FROM pending_offline_transactions WHERE username = ? ORDER BY seq ASC',
      [username]
    );
    const seqs = rows
      .map((r) => r.seq)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    if (seqs.length === 0) return { ok: true, gaps: [] };

    const gaps: number[] = [];
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] !== seqs[i - 1] + 1) {
        for (let missing = seqs[i - 1] + 1; missing < seqs[i]; missing++) gaps.push(missing);
      }
    }
    return { ok: gaps.length === 0, gaps };
  } catch (error) {
    console.warn('Failed to check queue integrity:', error);
    return { ok: true, gaps: [] };
  }
}

/**
 * Remove a resolved/settled offline transaction from the queue and its secured envelope.
 */
export async function removePendingOfflineTransaction(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM pending_offline_transactions WHERE id = ?', [id]);
    await SecureStore.deleteItemAsync(`${PENDING_ENV_PREFIX}${id}`).catch(() => {});
    await SecureStore.deleteItemAsync(`${PENDING_META_PREFIX}${id}`).catch(() => {});
  } catch (error) {
    console.warn('Failed to delete pending offline transaction:', error);
  }
}

/**
 * Save profile image (base64) for a user.
 */
export async function saveProfileImage(username: string, base64Image: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO user_settings (username, profile_image) VALUES (?, ?)`,
      [username, base64Image]
    );
  } catch (error) {
    console.warn('Failed to save profile image:', error);
  }
}

/**
 * Get profile image (base64) for a user.
 */
export async function getProfileImage(username: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ profile_image: string }>(
      'SELECT profile_image FROM user_settings WHERE username = ?',
      [username]
    );
    return row?.profile_image || null;
  } catch (error) {
    console.warn('Failed to get profile image:', error);
    return null;
  }
}

/**
 * Delete profile image for a user.
 */
export async function deleteProfileImage(username: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM user_settings WHERE username = ?', [username]);
  } catch (error) {
    console.warn('Failed to delete profile image:', error);
  }
}

/**
 * Save display name for a user.
 */
export async function saveDisplayName(username: string, displayName: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO user_settings (username, display_name) VALUES (?, ?)
       ON CONFLICT(username) DO UPDATE SET display_name = excluded.display_name`,
      [username, displayName]
    );
  } catch (error) {
    console.warn('Failed to save display name:', error);
  }
}

/**
 * Get display name for a user.
 */
export async function getDisplayName(username: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ display_name: string }>(
      'SELECT display_name FROM user_settings WHERE username = ?',
      [username]
    );
    return row?.display_name || null;
  } catch (error) {
    console.warn('Failed to get display name:', error);
    return null;
  }
}

/**
 * Check if a QR nonce has already been consumed (replay attack protection).
 */
export async function isQrNonceUsed(nonce: string): Promise<boolean> {
  if (!nonce) return true;
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ nonce: string }>(
      'SELECT nonce FROM used_qr_nonces WHERE nonce = ?',
      [nonce]
    );
    return !!row;
  } catch (error) {
    console.warn('Failed to check QR nonce:', error);
    return false;
  }
}

/**
 * Permanently mark a QR nonce as consumed to burn replay attempts.
 */
export async function markQrNonceUsed(nonce: string, sender: string, receiver: string): Promise<void> {
  if (!nonce) return;
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR IGNORE INTO used_qr_nonces (nonce, scanned_at_epoch, sender, receiver) VALUES (?, ?, ?, ?)',
      [nonce, Date.now(), sender, receiver]
    );
  } catch (error) {
    console.warn('Failed to mark QR nonce as used:', error);
  }
}

/**
 * Irreversibly deduct a security penalty from the user's balance and record an immutable forfeiture.
 */
export async function recordSecurityPenaltyLocal(
  username: string,
  penaltyAmount: number,
  reason: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    const db = await getDb();
    const cachedUser = await getCachedUser(username);
    const currentBalance = Number(cachedUser?.balance || 0);
    const newBalance = Math.max(0, currentBalance - penaltyAmount);

    if (cachedUser) {
      cachedUser.balance = newBalance;
      await saveCachedUser(username, cachedUser);
    }

    const txId = `PENALTY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const nowIso = new Date().toISOString();
    const penaltyTx = {
      id: txId,
      sender_username: username,
      receiver_username: 'BANK_SECURITY_ESCROW',
      amount: penaltyAmount,
      type: 'security_fraud_penalty',
      status: 'forfeited_no_refund',
      failure_reason: reason,
      reference: txId,
      created_at: nowIso,
    };
    await mergeCachedTransactions(username, [penaltyTx]);

    const penaltyNotif = {
      id: `notif-penalty-${Date.now()}`,
      title: 'নিরাপত্তা জরিমানা কর্তন ⚠️',
      message: `পরপর ৫ বার প্রতারণামূলক QR চেষ্টার কারণে ৳${penaltyAmount} নিরাপত্তা জরিমানা কেটে নেওয়া হয়েছে এবং ব্যাংকে জানানো হয়েছে।`,
      notification_type: 'security_penalty',
      created_at: nowIso,
    };
    await mergeCachedNotifications(username, [penaltyNotif]);

    return { success: true, newBalance };
  } catch (error) {
    console.warn('Failed to record security penalty locally:', error);
    return { success: false, newBalance: 0 };
  }
}
