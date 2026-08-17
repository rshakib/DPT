import * as api from './api';
import * as db from './db';

type SyncListener = () => void;

class SyncService {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private isPaused = false;
  private currentUsername: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private syncIntervalMs = 15000; // 15s delta sync interval

  /**
   * Subscribe to cache updates (triggers UI re-render when SQLite changes)
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    console.log('[SYNC SERVICE] Notifying subscribers of SQLite data update');
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.warn('[SYNC SERVICE] Error in listener:', err);
      }
    });
  }

  /**
   * Pause sync execution during critical flows (e.g. active transactions)
   */
  pauseSync(): void {
    console.log('[SYNC SERVICE] Pausing background sync service');
    this.isPaused = true;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Resume sync execution after critical flows complete
   */
  resumeSync(username?: string): void {
    console.log('[SYNC SERVICE] Resuming background sync service');
    this.isPaused = false;
    const targetUser = username || this.currentUsername;
    if (targetUser) {
      this.startBackgroundSync(targetUser);
    }
  }

  /**
   * Performs an immediate initial sync download right after login or app startup.
   */
  async initialSync(username: string): Promise<void> {
    if (!username || this.isPaused) return;
    this.currentUsername = username;
    console.log(`[SYNC SERVICE] Starting initialSync for user: ${username}`);

    try {
      // 1. Fetch & cache user profile
      console.log('[SYNC SERVICE] Fetching user profile...');
      const userRes = await api.getUser(username);
      if (userRes.success && userRes.data) {
        console.log('[SYNC SERVICE] User profile received, saving to SQLite cache');
        await db.saveCachedUser(username, userRes.data);
      } else {
        console.warn('[SYNC SERVICE] User profile fetch returned unsuccessful:', userRes.message);
      }

      // 2. Fetch & cache full transactions
      console.log('[SYNC SERVICE] Fetching transactions...');
      const txRes = await api.getTransactions(username);
      if (txRes.success && Array.isArray(txRes.data)) {
        console.log(`[SYNC SERVICE] Received ${txRes.data.length} transactions, saving to SQLite`);
        await db.saveCachedTransactions(username, txRes.data);
      } else {
        console.warn('[SYNC SERVICE] Transactions fetch returned unsuccessful:', txRes.message);
      }

      // 3. Fetch & cache full notifications
      console.log('[SYNC SERVICE] Fetching notifications...');
      const notifRes = await api.getNotifications(username);
      if (notifRes.success && Array.isArray(notifRes.data)) {
        console.log(`[SYNC SERVICE] Received ${notifRes.data.length} notifications, saving to SQLite`);
        await db.saveCachedNotifications(username, notifRes.data);
      } else {
        console.warn('[SYNC SERVICE] Notifications fetch returned unsuccessful:', notifRes.message);
      }

      // Notify UI subscribers of refreshed SQLite data
      console.log('[SYNC SERVICE] initialSync completed successfully!');
      this.notifyListeners();
    } catch (error) {
      console.error('[SYNC SERVICE] Exception during initialSync:', error);
    }
  }

  /**
   * Performs a delta sync (only fetches new or modified records via updated_at / last_sync_time)
   */
  async deltaSync(username: string): Promise<void> {
    if (!username || this.isSyncing) return;

    this.isSyncing = true;
    let hasChanges = false;
    console.log(`[SYNC SERVICE] Starting deltaSync for user: ${username}`);

    try {
      // 1. User profile sync
      const userRes = await api.getUser(username);
      if (userRes.success && userRes.data) {
        await db.saveCachedUser(username, userRes.data);
        hasChanges = true;
      }

      // 2. Transaction delta sync using latest timestamp
      const latestTxTime = await db.getLatestCachedTransactionTimestamp(username);
      console.log(`[SYNC SERVICE] Latest cached transaction timestamp in SQLite: ${latestTxTime}`);
      const txRes = await api.getTransactions(username, latestTxTime || undefined);
      if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
        console.log(`[SYNC SERVICE] Received ${txRes.data.length} new/updated transactions, merging into SQLite`);
        await db.mergeCachedTransactions(username, txRes.data);
        hasChanges = true;
      }

      // 3. Notification delta sync using latest timestamp
      const latestNotifTime = await db.getLatestCachedNotificationTimestamp(username);
      console.log(`[SYNC SERVICE] Latest cached notification timestamp in SQLite: ${latestNotifTime}`);
      const notifRes = await api.getNotifications(username, latestNotifTime || undefined);
      if (notifRes.success && Array.isArray(notifRes.data) && notifRes.data.length > 0) {
        console.log(`[SYNC SERVICE] Received ${notifRes.data.length} new/updated notifications, merging into SQLite`);
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

  /**
   * Starts continuous background polling sync for the given user
   */
  startBackgroundSync(username: string): void {
    this.stopBackgroundSync();

    if (!username) return;
    this.currentUsername = username;

    if (this.isPaused) {
      console.log(`[SYNC SERVICE] Sync is currently paused. Saved user ${username} for subsequent resume.`);
      return;
    }

    console.log(`[SYNC SERVICE] Starting background sync timer for user: ${username}`);

    // Run initial delta sync
    this.deltaSync(username);

    // Schedule background interval
    this.syncTimer = setInterval(() => {
      this.deltaSync(username);
    }, this.syncIntervalMs);
  }

  /**
   * Stops active background sync
   */
  stopBackgroundSync(): void {
    if (this.syncTimer) {
      console.log('[SYNC SERVICE] Stopping background sync timer');
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isSyncing = false;
  }
}

export const syncService = new SyncService();
