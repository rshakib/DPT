import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';
import { syncService } from '../services/sync';

const { width } = Dimensions.get('window');

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
  iconName: any;
  iconBg: string;
  iconColor: string;
}

function formatRelativeTime(isoString: string): string {
  try {
    const cleanStr = String(isoString).replace('Z', '+00:00');
    const date = new Date(cleanStr);
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) return 'Just now';

    // Calendar day comparison in LOCAL time
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const calendarDaysDiff = Math.round((todayDay.getTime() - dateDay.getTime()) / 86400000);

    if (calendarDaysDiff === 0) {
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      return `${diffHours}h ago`;
    }

    if (calendarDaysDiff === 1) return 'Yesterday';
    if (calendarDaysDiff > 1 && calendarDaysDiff < 7) return `${calendarDaysDiff}d ago`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return 'Just now';
  }
}

export default function Notifications() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, logout } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mapRawNotifications = (rawList: any[], localReadIds: string[]) => {
    // Deduplicate login notifications: Keep only the single freshest login notification
    let loginSeen = false;
    const filteredList = rawList.filter((n: any) => {
      const typeLower = String(n.notification_type || n.type || '').toLowerCase();
      const titleLower = String(n.title || '').toLowerCase();
      const messageLower = String(n.message || n.body || '').toLowerCase();
      const isLoginNotif =
        typeLower.includes('login') ||
        titleLower.includes('login') ||
        messageLower.includes('logged in') ||
        messageLower.includes('login');

      if (isLoginNotif) {
        if (!loginSeen) {
          loginSeen = true; // Keep only the first (newest/freshest) login notification
          return true;
        }
        return false; // Exclude older duplicate login notifications
      }
      return true;
    });

    // Drop exact duplicate notifications (same title + message) — the same event can
    // be recorded more than once (client local + server, or repeated syncs). Keep the
    // newest (list is already ordered newest-first).
    const seenNotif = new Set<string>();
    const dedupedList = filteredList.filter((n: any) => {
      const key = `${String(n.title || '')}||${String(n.message || n.body || '')}`;
      if (seenNotif.has(key)) return false;
      seenNotif.add(key);
      return true;
    });

    return dedupedList.map((n: any) => {
      const typeLower = String(n.notification_type || n.type || '').toLowerCase();
      let iconName = 'notifications-outline';
      let iconBg = '#FFF9E6';
      let iconColor = '#FF9500';

      if (typeLower.includes('success') || typeLower.includes('payment') || typeLower.includes('received') || typeLower.includes('transfer')) {
        iconName = 'wallet-outline';
        iconBg = '#E6FFF2';
        iconColor = '#3BA53A';
      } else if (typeLower.includes('fail') || typeLower.includes('abort') || typeLower.includes('error')) {
        iconName = 'alert-circle-outline';
        iconBg = '#FFF0F0';
        iconColor = '#FF3838';
      } else if (typeLower.includes('security') || typeLower.includes('login') || typeLower.includes('auth')) {
        iconName = 'shield-checkmark-outline';
        iconBg = '#E6F4FF';
        iconColor = '#00A4E4';
      }

      const isRead = !!n.is_read || localReadIds.includes(String(n.id));

      return {
        id: String(n.id || Math.random()),
        title: n.title || 'Notification',
        message: n.message || '',
        time: formatRelativeTime(n.created_at || new Date().toISOString()),
        isRead,
        iconName,
        iconBg,
        iconColor,
      };
    });
  };

  const fetchNotifications = async () => {
    if (!user?.username) return;

    let hasCachedData = false;
    console.log(`[NOTIFICATIONS] Fetching notifications for user: ${user.username}`);

    // Retrieve locally persisted read states
    let localReadIds: string[] = [];
    try {
      const storageKey = `niropay_read_notifications_${user.username}`;
      const stored = await SecureStore.getItemAsync(storageKey);
      if (stored) {
        localReadIds = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[NOTIFICATIONS] Failed to retrieve read notifications state:', e);
    }

    // 1. Instantly read SQLite cache
    try {
      const cachedRaw = await db.getCachedNotifications(user.username);
      if (cachedRaw && cachedRaw.length > 0) {
        console.log(`[NOTIFICATIONS] SQLite Cache HIT (${cachedRaw.length} notifications)`);
        const cachedMapped = mapRawNotifications(cachedRaw, localReadIds);
        setNotifications(cachedMapped);
        setIsLoading(false);
        hasCachedData = true;
      }
    } catch (e) {
      console.warn('[NOTIFICATIONS] Failed to read cached notifications:', e);
    }

    if (!hasCachedData) {
      console.log('[NOTIFICATIONS] SQLite cache MISS. Showing loading indicator...');
      setIsLoading(true);
    }
    setErrorMessage(null);

    // 2. Perform delta sync in background
    try {
      await syncService.deltaSync(user.username);
      let updatedCache = await db.getCachedNotifications(user.username);

      // Fallback: If SQLite cache is still empty, fetch directly from API
      if (!updatedCache || updatedCache.length === 0) {
        console.log('[NOTIFICATIONS] Fallback to direct API for notifications...');
        const notifRes = await api.getNotifications(user.username);
        if (notifRes.success && Array.isArray(notifRes.data) && notifRes.data.length > 0) {
          await db.saveCachedNotifications(user.username, notifRes.data);
          updatedCache = notifRes.data;
        }
      }

      if (updatedCache) {
        const mapped = mapRawNotifications(updatedCache, localReadIds);
        setNotifications(mapped);
      }
    } catch (err: any) {
      console.error('[NOTIFICATIONS] Error fetching notifications:', err);
      setErrorMessage(err.message || 'Failed to update notifications.');
    } finally {
      console.log('[NOTIFICATIONS] Clearing loading state in finally block');
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      const unsubscribe = syncService.subscribe(async () => {
        if (user?.username) {
          const updatedCache = await db.getCachedNotifications(user.username);
          let localReadIds: string[] = [];
          try {
            const storageKey = `niropay_read_notifications_${user.username}`;
            const stored = await SecureStore.getItemAsync(storageKey);
            if (stored) localReadIds = JSON.parse(stored);
          } catch (e) {}
          const mapped = mapRawNotifications(updatedCache, localReadIds);
          setNotifications(mapped);
        }
      });
      return () => {
        unsubscribe();
      };
    }, [user?.username])
  );

  const handleNotificationPress = async (id: string) => {
    // Mark as read in local state for immediate visual response
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    // Persist this read status in SecureStore
    if (!user?.username) return;
    try {
      const storageKey = `niropay_read_notifications_${user.username}`;
      const stored = await SecureStore.getItemAsync(storageKey);
      let readIds: string[] = stored ? JSON.parse(stored) : [];
      
      if (!readIds.includes(id)) {
        readIds.push(id);
        
        // Cap the array at 200 items to prevent unbounded local file growth
        if (readIds.length > 200) {
          readIds = readIds.slice(readIds.length - 200);
        }
        await SecureStore.setItemAsync(storageKey, JSON.stringify(readIds));
      }
    } catch (e) {
      console.warn('Failed to save read notification state:', e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Header title={t.notificationsTitle || 'Notifications'} />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t.loadingNotifications || 'Loading notifications...'}
          </Text>
        </View>
      ) : errorMessage ? (
        /* ERROR STATE VIEW WITH RETRY */
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={54} color={theme.error} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {language === 'en' ? 'Unable to load notifications' : 'বিজ্ঞপ্তি লোড করা সম্ভব হয়নি'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={fetchNotifications}
          >
            <Text style={styles.retryButtonText}>
              {language === 'en' ? 'Retry' : 'পুনরায় চেষ্টা করুন'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        /* EMPTY STATE VIEW */
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FAF9FF', borderColor: theme.border }]}>
            <Ionicons name="notifications" size={44} color={theme.primary} />
            <View style={[styles.sparkle, styles.sparkle1]}>
              <Ionicons name="sparkles" size={12} color={theme.primary} />
            </View>
            <View style={[styles.sparkle, styles.sparkle2]}>
              <Ionicons name="sparkles" size={14} color={theme.primary} />
            </View>
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t.noNotifications || 'No notifications yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {t.seeUpdatesAlerts || "You'll see important updates and alerts here."}
          </Text>
        </View>
      ) : (
        /* NOTIFICATIONS LIST VIEW */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((n) => {
            const isUnread = !n.isRead;
            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.notificationCard,
                  isUnread
                    ? [styles.cardUnread, { backgroundColor: isDarkMode ? '#2C2754' : '#F8F7FF', borderColor: isDarkMode ? '#2C2754' : '#ECE9FC' }]
                    : [styles.cardRead, { backgroundColor: theme.cardBg, borderColor: theme.border }],
                ]}
                onPress={() => handleNotificationPress(n.id)}
                activeOpacity={0.8}
              >
                {/* Left Circle Icon */}
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#1E1E1E' : n.iconBg }]}>
                  <Ionicons name={n.iconName} size={22} color={isDarkMode ? theme.primary : n.iconColor} />
                </View>

                {/* Middle Text Details */}
                <View style={styles.textContainer}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{n.title}</Text>
                  <Text style={[styles.cardMessage, { color: theme.textSecondary }]}>{n.message}</Text>
                </View>

                {/* Right Side Info: Time and Unread dot */}
                <View style={styles.rightColumn}>
                  <Text style={[styles.timeText, { color: theme.textSecondary }]}>{n.time}</Text>
                  {isUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardUnread: {},
  cardRead: {},
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 3,
    paddingTop: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardMessage: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  rightColumn: {
    alignItems: 'flex-end',
    paddingTop: 3,
    minWidth: 64,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: Spacing.sm,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.huge,
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.sm,
  },
  sparkle: {
    position: 'absolute',
    opacity: 0.7,
  },
  sparkle1: {
    top: 10,
    right: 8,
  },
  sparkle2: {
    bottom: 12,
    left: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
}) as any;
