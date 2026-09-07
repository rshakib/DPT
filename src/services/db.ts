import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
       AND (type = 'transfer' OR type = 'user_transfer' OR type = 'send_money' OR type = 'merchant_payment' OR type = 'mobile_recharge' OR type = 'bill_payment' OR type = 'cashout' OR type = 'cash_out' OR type = 'qr_payment')`,
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
    const rows = await db.getAllAsync<{ raw_json: string }>(
      'SELECT raw_json FROM cached_transactions WHERE username = ? ORDER BY created_at_epoch DESC',
      [username]
    );
    return rows.map((r) => JSON.parse(r.raw_json));
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
      await db.runAsync('DELETE FROM cached_transactions WHERE username = ?', [username]);
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
    const rows = await db.getAllAsync<{ raw_json: string }>(
      'SELECT raw_json FROM cached_notifications WHERE username = ? ORDER BY created_at_epoch DESC',
      [username]
    );
    return rows.map((r) => JSON.parse(r.raw_json));
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
  reference: string
): Promise<void> {
  try {
    const db = await getDb();
    const createdAt = new Date().toISOString();
    const createdAtEpoch = Date.now();
    const payload = { id: reference, username, receiver, amount, type, reference, createdAt };

    await db.runAsync(
      `INSERT OR REPLACE INTO pending_offline_transactions (id, username, receiver, amount, type, created_at, created_at_epoch, status, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, username, receiver, amount, type, createdAt, createdAtEpoch, 'pending', JSON.stringify(payload)]
    );
  } catch (error) {
    console.warn('Failed to save pending offline transaction:', error);
  }
}

/**
 * Retrieve all pending offline transactions for a user.
 */
export async function getPendingOfflineTransactions(username: string): Promise<any[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<{ raw_json: string }>(
      'SELECT raw_json FROM pending_offline_transactions WHERE username = ? ORDER BY created_at_epoch ASC',
      [username]
    );
    return rows.map((r) => JSON.parse(r.raw_json));
  } catch (error) {
    console.warn('Failed to retrieve pending offline transactions:', error);
    return [];
  }
}

/**
 * Remove a resolved/settled offline transaction from the queue.
 */
export async function removePendingOfflineTransaction(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM pending_offline_transactions WHERE id = ?', [id]);
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
