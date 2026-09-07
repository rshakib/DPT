import * as api from './api';
import * as db from './db';

type SyncListener = () => void;
type ReconciliationAlert = { title: string; message: string };

class SyncService {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private syncStartTime = 0;
  private isPaused = false;
  private currentUsername: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private reconciliationAlertCallback: ((alert: ReconciliationAlert) => void) | null = null;
  private pendingAlerts: ReconciliationAlert[] = [];
  private syncIntervalMs = 15000; // 15s delta sync interval
  private healthCheckIntervalMs = 14 * 60 * 1000; // 14 minutes — keeps Render free-tier awake
  private maxSyncDurationMs = 30000; // 30s — force-reset if stuck

  /**
   * Register a callback to show popup alerts when offline transactions are reconciled.
   * If there are pending alerts (from reconciliation that happened before callback was set),
   * they are replayed immediately.
   */
  setReconciliationAlertCallback(callback: ((alert: ReconciliationAlert) => void) | null): void {
    this.reconciliationAlertCallback = callback;
    if (callback && this.pendingAlerts.length > 0) {
      const alerts = [...this.pendingAlerts];
      this.pendingAlerts = [];
      alerts.forEach((alert) => callback(alert));
    }
  }

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
   * Public method to notify all listeners that SQLite data has changed.
   * Call this after writing offline transactions to trigger immediate UI refresh.
   */
  notifyDataChanged(): void {
    this.notifyListeners();
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
      console.log('[SYNC SERVICE] Fetching ALL transactions (no timestamp filter)...');
      const txRes = await api.getTransactions(username);
      console.log(`[SYNC SERVICE] Transactions API result: success=${txRes.success}, count=${Array.isArray(txRes.data) ? txRes.data.length : 'not-array'}, message=${txRes.message || 'none'}`);
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
    if (!username) return;

    // Safety: force-reset if previous sync got stuck (e.g. network timeout)
    if (this.isSyncing) {
      const elapsed = Date.now() - this.syncStartTime;
      if (elapsed > this.maxSyncDurationMs) {
        console.warn(`[SYNC SERVICE] Previous sync stuck for ${elapsed}ms, force-resetting`);
        this.isSyncing = false;
      } else {
        return;
      }
    }

    this.isSyncing = true;
    this.syncStartTime = Date.now();
    let hasChanges = false;
    console.log(`[SYNC SERVICE] Starting deltaSync for user: ${username}`);

    try {
      // 0. Flush any pending offline transactions to server
      const pendingTx = await db.getPendingOfflineTransactions(username);
      if (pendingTx && pendingTx.length > 0) {
        console.log(`[SYNC SERVICE] Found ${pendingTx.length} pending offline transactions. Flushing to server...`);
        for (const offlineItem of pendingTx) {
          try {
            const transferRes = await api.transfer(username, offlineItem.receiver, offlineItem.amount);
            if (transferRes.success) {
              console.log(`[SYNC SERVICE] Offline transaction ${offlineItem.id} settled successfully!`);
              await db.removePendingOfflineTransaction(offlineItem.id);

              // Delete the OFF- row from cached_transactions to prevent duplicates.
              // The server sync below will fetch the real transaction with the correct server ID.
              try {
                const db2 = await db.getDb();
                await db2.runAsync('DELETE FROM cached_transactions WHERE id = ?', [offlineItem.id]);
              } catch (delErr) {
                console.warn('[SYNC SERVICE] Failed to delete offline tx from cache:', delErr);
              }

              // Save success notification to SQLite
              const successNotif = {
                id: `notif-offline-success-${Date.now()}`,
                title: 'অফলাইন লেনদেন সফল হয়েছে',
                message: `৳${offlineItem.amount} টাকা @${offlineItem.receiver}-এ সফলভাবে পাঠানো হয়েছে।`,
                notification_type: 'transfer_success',
                created_at: new Date().toISOString(),
              };
              await db.mergeCachedNotifications(username, [successNotif]);
              hasChanges = true;

              // Show popup or store as pending
              const successAlert = {
                title: 'অফলাইন লেনদেন সফল ✅',
                message: `৳${offlineItem.amount} টাকা @${offlineItem.receiver}-এ সফলভাবে পাঠানো হয়েছে।`,
              };
              if (this.reconciliationAlertCallback) {
                this.reconciliationAlertCallback(successAlert);
              } else {
                this.pendingAlerts.push(successAlert);
              }
            } else {
              const errorMsg = (transferRes.message || '').toLowerCase();
              const isNetworkError = errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection failed');

              if (isNetworkError) {
                // Network error — device is still offline, skip this transaction and retry later
                console.log(`[SYNC SERVICE] Offline transaction ${offlineItem.id} — still offline, will retry next cycle`);
                continue;
              }

              // Server explicitly rejected the transaction (e.g., receiver not found)
              console.warn(`[SYNC SERVICE] Offline transaction ${offlineItem.id} rejected by server: ${transferRes.message}`);
              
              // Remove the rejected transaction from the pending queue
              await db.removePendingOfflineTransaction(offlineItem.id);

              // Delete the OFF- record from cached_transactions to prevent duplicates
              try {
                const db2 = await db.getDb();
                await db2.runAsync('DELETE FROM cached_transactions WHERE id = ?', [offlineItem.id]);
              } catch (delErr) {
                console.warn('[SYNC SERVICE] Failed to delete offline tx from cache:', delErr);
              }

              // REFUND: Restore the locally deducted balance
              try {
                const cachedUser = await db.getCachedUser(username);
                if (cachedUser) {
                  const currentBalance = Number(cachedUser.balance || 0);
                  const currentSpent = Number(cachedUser.today_spent || cachedUser.todaySpent || 0);
                  const refundAmount = Number(offlineItem.amount || 0);

                  cachedUser.balance = currentBalance + refundAmount;
                  cachedUser.today_spent = Math.max(0, currentSpent - refundAmount);
                  await db.saveCachedUser(username, cachedUser);
                  console.log(`[SYNC SERVICE] Refunded ৳${refundAmount} to ${username}. New balance: ${cachedUser.balance}`);
                }
              } catch (refundErr) {
                console.warn('[SYNC SERVICE] Failed to refund balance:', refundErr);
              }

              // Insert the FAIL- record (OFF- record already deleted above)
              try {
                const failedTx = {
                  id: offlineItem.id.replace('OFF-', 'FAIL-'),
                  sender_username: username,
                  receiver_username: offlineItem.receiver,
                  amount: offlineItem.amount,
                  type: offlineItem.type || 'transfer',
                  status: 'failed',
                  failure_reason: transferRes.message,
                  reference: offlineItem.id.replace('OFF-', 'FAIL-'),
                  created_at: offlineItem.created_at || new Date().toISOString(),
                };
                await db.mergeCachedTransactions(username, [failedTx]);
              } catch (txErr) {
                console.warn('[SYNC SERVICE] Failed to update transaction status:', txErr);
              }

              // Inject a notification to inform the user (Bangla)
              const refundNotif = {
                id: `notif-refund-${Date.now()}`,
                title: 'অফলাইন লেনদেন ব্যর্থ - টাকা ফেরত',
                message: `@${offlineItem.receiver}-এ ৳${offlineItem.amount} টাকা পাঠানো যায়নি। আপনার ব্যালেন্স পুনরুদ্ধার করা হয়েছে।`,
                notification_type: 'security',
                created_at: new Date().toISOString(),
              };
              await db.mergeCachedNotifications(username, [refundNotif]);
              hasChanges = true;

              // Show popup or store as pending
              const failAlert = {
                title: 'অফলাইন লেনদেন ব্যর্থ ❌',
                message: `@${offlineItem.receiver}-এ ৳${offlineItem.amount} টাকা পাঠানো যায়নি। টাকা আপনার অ্যাকাউন্টে ফেরত দেওয়া হয়েছে।`,
              };
              if (this.reconciliationAlertCallback) {
                this.reconciliationAlertCallback(failAlert);
              } else {
                this.pendingAlerts.push(failAlert);
              }
            }
          } catch (e) {
            console.warn(`[SYNC SERVICE] Retrying offline transaction ${offlineItem.id} later:`, e);
          }
        }
      }

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
      console.log(`[SYNC SERVICE] Transactions API response: success=${txRes.success}, dataLength=${Array.isArray(txRes.data) ? txRes.data.length : 'not-array'}, message=${txRes.message || 'none'}`);
      if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
        console.log(`[SYNC SERVICE] Received ${txRes.data.length} new/updated transactions, merging into SQLite`);
        await db.mergeCachedTransactions(username, txRes.data);
        hasChanges = true;
      } else if (txRes.success && Array.isArray(txRes.data) && txRes.data.length === 0) {
        console.log('[SYNC SERVICE] No new transactions from server');
      } else {
        console.warn(`[SYNC SERVICE] Transactions fetch failed: ${txRes.message}`);
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

    // Start health check timer to keep Render server awake (every 14 minutes)
    this.runHealthCheck(); // immediate first ping
    this.healthTimer = setInterval(() => {
      this.runHealthCheck();
    }, this.healthCheckIntervalMs);
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
    if (this.healthTimer) {
      console.log('[SYNC SERVICE] Stopping health check timer');
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.isSyncing = false;
  }

  /**
   * Force an immediate sync, bypassing the isSyncing guard.
   * Call this when the app returns to foreground or internet reconnects.
   */
  async forceSync(username?: string): Promise<void> {
    const targetUser = username || this.currentUsername;
    if (!targetUser) return;
    console.log('[SYNC SERVICE] Force sync triggered');
    this.isSyncing = false; // reset any stuck state
    await this.deltaSync(targetUser);
  }

  /**
   * Lightweight health check ping to prevent Render free-tier server from sleeping.
   * Also keeps Supabase active since the backend queries it on any request.
   */
  private async runHealthCheck(): Promise<void> {
    try {
      const isAlive = await api.healthCheck();
      if (isAlive) {
        console.log('[HEALTH CHECK] Server is awake');
      } else {
        console.warn('[HEALTH CHECK] Server might be sleeping, will retry next cycle');
      }
    } catch (e) {
      console.warn('[HEALTH CHECK] Ping failed:', e);
    }
  }
}

export const syncService = new SyncService();
