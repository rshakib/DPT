import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';
import { syncService } from '../services/sync';
import { mapApiTransaction } from '../utils/transactionMapper';

const { width } = Dimensions.get('window');

interface GridItemProps {
  title: string;
  iconName: any;
  route: string;
  iconType?: 'ionicons' | 'mcommunity';
}

function GridItem({
  title,
  iconName,
  route,
  iconType = 'ionicons',
  onNavigate,
  theme,
  isDarkMode,
}: GridItemProps & { onNavigate: (route: string) => void; theme: any; isDarkMode: boolean }) {
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onNavigate(route)}
      activeOpacity={0.7}
    >
      <View style={[styles.gridIconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF', borderColor: theme.border }]}>
        {iconType === 'mcommunity' ? (
          <MaterialCommunityIcons name={iconName} size={26} color={theme.primary} />
        ) : (
          <Ionicons name={iconName} size={26} color={theme.primary} />
        )}
      </View>
      <Text style={[styles.gridItemText, { color: theme.text }]} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, updateUser, logout } = useAuth();

  const [showBalance, setShowBalance] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.full_name || user?.username || '');

  // Dynamic API Fetching States
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);

  const fetchDashboardData = async (showPullToRefreshSpinner = false) => {
    const activeUsername = user?.username;
    if (!activeUsername) {
      setBalanceLoading(false);
      setTransactionsLoading(false);
      return;
    }

    let hasCachedData = false;

    // 1. Instantly read SQLite cache on mount/focus
    try {
      const cachedUser = await db.getCachedUser(activeUsername);
      const cachedTx = await db.getCachedTransactions(activeUsername);

      if (cachedUser) {
        const canonicalUser = cachedUser.user || cachedUser;
        await updateUser(canonicalUser);
        setBalanceLoading(false);
        hasCachedData = true;
      }
      if (cachedTx && Array.isArray(cachedTx) && cachedTx.length > 0) {
        setTransactions(cachedTx.slice(0, 3));
        setTransactionsLoading(false);
        hasCachedData = true;
      }
    } catch (e) {
      console.warn('Failed to read SQLite cache:', e);
    }

    if (showPullToRefreshSpinner) {
      setRefreshing(true);
    } else if (!hasCachedData) {
      setBalanceLoading(true);
      setTransactionsLoading(true);
    }
    setErrorOccurred(false);

    try {
      // 2. Perform delta sync in background
      await syncService.deltaSync(activeUsername);
      
      let updatedUser = await db.getCachedUser(activeUsername);
      let updatedTx = await db.getCachedTransactions(activeUsername);

      // Fallback: If SQLite cache is still empty, fetch directly from API for first launch guarantee
      if (!updatedUser) {
        const userRes = await api.getUser(activeUsername);
        if (userRes.success && userRes.data) {
          const freshUser = userRes.data.user || userRes.data;
          await db.saveCachedUser(activeUsername, freshUser);
          updatedUser = freshUser;
        }
      }

      if (!updatedTx || updatedTx.length === 0) {
        const txRes = await api.getTransactions(activeUsername);
        if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
          await db.saveCachedTransactions(activeUsername, txRes.data);
          updatedTx = txRes.data;
        }
      }

      if (updatedUser) {
        const canonicalUser = updatedUser.user || updatedUser;
        await updateUser(canonicalUser);
      }
      if (updatedTx && Array.isArray(updatedTx)) {
        setTransactions(updatedTx.slice(0, 3));
      }
    } catch (err) {
      setErrorOccurred(true);
    } finally {
      setBalanceLoading(false);
      setTransactionsLoading(false);
      setRefreshing(false);
    }
  };

  const navigation = useNavigation();

  // Trigger data fetch and subscribe to sync updates on focus
  useFocusEffect(
    useCallback(() => {
      try {
        const state = navigation.getState();
        const currentRoutes = state?.routes?.map((r: any) => r.name) || [];
        console.log('[DASHBOARD MOUNT/FOCUS] Active route stack:', currentRoutes);
      } catch (e) {}

      fetchDashboardData();

      // Load profile image from SQLite and display name from user object
      if (user?.username) {
        db.getProfileImage(user.username).then((img) => {
          if (img) setProfileImage(img);
        });
        // Use full_name from user object (set during login)
        if (user.full_name) {
          setDisplayName(user.full_name);
        }
      }

      const unsubscribe = syncService.subscribe(async () => {
        const currentUsername = user?.username;
        if (currentUsername) {
          const cachedUser = await db.getCachedUser(currentUsername);
          const cachedTx = await db.getCachedTransactions(currentUsername);
          if (cachedUser) {
            const canonicalUser = cachedUser.user || cachedUser;
            await updateUser(canonicalUser);
            setBalanceLoading(false);
          }
          if (cachedTx && Array.isArray(cachedTx)) {
            setTransactions(cachedTx.slice(0, 3));
            setTransactionsLoading(false);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }, [user?.username])
  );

  const handleToggleBalance = () => {
    setShowBalance(!showBalance);
  };

  const handleNavigate = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Header Name & Profile Icon */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greetingText, { color: theme.textSecondary }]}>
              {t.welcomeBack || 'Welcome Back'}
            </Text>
            <Text style={[styles.userNameText, { color: theme.text }]}>
              {displayName || user?.username || 'User'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF', borderColor: theme.border }]}
            onPress={() => handleNavigate('/profile')}
            activeOpacity={0.8}
          >
            {profileImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                style={styles.profileButtonImage}
              />
            ) : (
              <Ionicons name="person" size={22} color={theme.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Dynamic Theme Balance Card */}
        <LinearGradient
          colors={theme.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          {/* Card watermark/accent decoration */}
          <View style={styles.cardWatermark} />

          <View style={styles.balanceCardHeader}>
            <Text style={styles.balanceTitle}>{t.totalBalance || 'Total Balance'}</Text>
            <TouchableOpacity onPress={handleToggleBalance} style={styles.eyeIconContainer}>
              <Ionicons
                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {balanceLoading ? (
            <View style={styles.balanceLoadingWrapper}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : (
            <Text style={styles.balanceAmount}>
              {showBalance
                ? `৳ ${parseFloat(user?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : '৳ ••••••'}
            </Text>
          )}

          <Text style={styles.balanceSubtitle}>{t.availableBalance || 'Available Balance'}</Text>

          {/* Quick Actions split row */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => handleNavigate('/send-money')}
              activeOpacity={0.7}
            >
              <View style={styles.cardActionIconWrapper}>
                <Ionicons name="paper-plane" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.cardActionText}>{t.sendMoney || 'Send Money'}</Text>
            </TouchableOpacity>

            <View style={styles.cardActionDivider} />

            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => handleNavigate('/cashout')}
              activeOpacity={0.7}
            >
              <View style={styles.cardActionIconWrapper}>
                <MaterialCommunityIcons name="bank-transfer-out" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.cardActionText}>{t.cashOut || 'Cash Out'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Feature Grid Container */}
        <View style={[styles.gridContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.gridRow}>
            <GridItem title={t.sendMoney || 'Send Money'} iconName="paper-plane-outline" route="/send-money" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title={t.merchantPayment || 'Merchant Payment'} iconName="storefront-outline" route="/merchant" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title={t.mobileRecharge || 'Mobile Recharge'} iconName="flash-outline" route="/recharge" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title={t.billPayment || 'Bill Payment'} iconName="document-text-outline" route="/bills" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
          </View>
          <View style={styles.gridRow}>
            <GridItem title={t.cashOut || 'Cash Out'} iconName="cash-outline" route="/cashout" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title={t.qrPay || 'QR Pay'} iconName="qr-code-outline" route="/qr-pay" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title={t.transactionHistory || 'Transaction History'} iconName="time-outline" route="/history" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
            <GridItem title="NFC Transfer" iconName="wifi-outline" route="/nfc-transfer" onNavigate={handleNavigate} theme={theme} isDarkMode={isDarkMode} />
          </View>
        </View>

        {/* Promotional Banner Card */}
        <TouchableOpacity
          style={[styles.bannerCard, { backgroundColor: isDarkMode ? '#1E1E1E' : '#F7F6FF', borderColor: theme.border }]}
          onPress={() => handleNavigate('/features')}
          activeOpacity={0.9}
        >
          <View style={styles.bannerLeftContent}>
            <Text style={[styles.bannerTitle, { color: theme.primary }]}>{t.additionalFeatures || 'Additional Features'}</Text>
            <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
              {t.exploreMoreMoney || 'Explore more ways to manage your money easily.'}
            </Text>
            <View style={[styles.bannerButton, { backgroundColor: theme.primary }]}>
              <Text style={styles.bannerButtonText}>{t.exploreNow || 'Explore Now'}</Text>
            </View>
          </View>
          <Image
            source={require('../../assets/images/additional_features_illustration.jpg')}
            style={styles.bannerImage}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Recent Activity Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.recentActivity || 'Recent Activity'}</Text>
          <TouchableOpacity onPress={() => handleNavigate('/history')} style={styles.viewAllRow}>
            <Text style={[styles.viewAllText, { color: theme.primary }]}>{t.viewAll || 'View All'}</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Recent Activity List */}
        <View style={styles.transactionsList}>
          {transactionsLoading ? (
            <View style={styles.listLoader}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : errorOccurred ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                {language === 'en' ? 'Failed to load transactions.' : 'লেনদেন লোড করতে ব্যর্থ হয়েছে।'}
              </Text>
              <TouchableOpacity onPress={() => fetchDashboardData(false)} style={styles.retryButton}>
                <Text style={[styles.retryButtonText, { color: theme.primary }]}>
                  {language === 'en' ? 'Retry' : 'পুনরায় চেষ্টা করুন'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                {language === 'en' ? 'No recent transactions.' : 'কোনো লেনদেন পাওয়া যায়নি।'}
              </Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const mapped = mapApiTransaction(tx, user?.username || '', t, language, theme);
              return (
                <TouchableOpacity
                  key={mapped.id}
                  style={[
                    styles.transactionCard,
                    {
                      backgroundColor: mapped.isOfflinePending
                        ? (isDarkMode ? 'rgba(255, 56, 56, 0.08)' : '#FFF5F5')
                        : theme.cardBg,
                      borderColor: mapped.isOfflinePending
                        ? (isDarkMode ? 'rgba(255, 56, 56, 0.2)' : '#FFD2D2')
                        : theme.border,
                    },
                  ]}
                  onPress={() => handleNavigate('/history')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : mapped.iconBg }]}>
                    <Ionicons name={mapped.icon as any} size={20} color={isDarkMode ? theme.primary : mapped.iconColor} />
                  </View>
                  <View style={styles.txMetaContainer}>
                    <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>
                      {mapped.title}
                    </Text>
                    <Text style={[styles.txTime, { color: theme.textSecondary }]}>{mapped.time}</Text>
                  </View>
                  <View style={styles.txAmountContainer}>
                    <Text style={[styles.txAmount, { color: theme.text }]}>{mapped.amount}</Text>
                    <Text
                      style={[
                        styles.txStatus,
                        {
                          color: mapped.isOfflinePending
                            ? theme.error
                            : mapped.status.includes('Successful') || mapped.status.includes('সফল')
                            ? theme.success
                            : theme.error
                        }
                      ]}
                    >
                      {mapped.isOfflinePending
                        ? (language === 'en' ? 'Offline Queue' : 'অফলাইন কিউ')
                        : mapped.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Premium Bottom Navigation Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderTopColor: theme.border }]}>
        {/* Tab 1: Home */}
        <TouchableOpacity style={styles.tabItem} onPress={() => {}}>
          <Ionicons name="home" size={24} color={theme.primary} />
          <Text style={[styles.tabText, { color: theme.primary, fontWeight: '700' }]}>{t.home || 'Home'}</Text>
        </TouchableOpacity>

        {/* Tab 2: History */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigate('/history')}>
          <Ionicons name="time-outline" size={24} color={theme.textSecondary} />
          <Text style={[styles.tabText, { color: theme.textSecondary }]}>{t.history || 'History'}</Text>
        </TouchableOpacity>

        {/* Tab 3: Centered QR FAB */}
        <View style={styles.qrFabContainer}>
          <TouchableOpacity
            style={[styles.qrFab, { backgroundColor: theme.primary }]}
            onPress={() => handleNavigate('/qr-pay')}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.qrFabText, { color: theme.primary }]}>{t.qr || 'QR'}</Text>
        </View>

        {/* Tab 4: Notifications */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigate('/notifications')}>
          <Ionicons name="notifications-outline" size={24} color={theme.textSecondary} />
          <Text style={[styles.tabText, { color: theme.textSecondary }]}>{t.alerts || 'Alerts'}</Text>
        </TouchableOpacity>

        {/* Tab 5: Profile */}
        <TouchableOpacity style={styles.tabItem} onPress={() => handleNavigate('/profile')}>
          <Ionicons name="person-outline" size={24} color={theme.textSecondary} />
          <Text style={[styles.tabText, { color: theme.textSecondary }]}>{t.profile || 'Profile'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  profileButtonImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  balanceCard: {
    borderRadius: 24,
    padding: Spacing.xl,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  cardWatermark: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  balanceTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyeIconContainer: {
    padding: 4,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  balanceLoadingWrapper: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  balanceSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: Spacing.xl,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: Spacing.md,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  cardActionIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardActionDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  gridContainer: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - 48 - 48) / 4,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  gridIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  bannerCard: {
    borderWidth: 1.5,
    borderRadius: 28,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  bannerLeftContent: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  bannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    marginRight: Spacing.sm,
  },
  bannerButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: Spacing.xs,
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerImage: {
    width: 80,
    height: 80,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  transactionsList: {
    gap: Spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: Spacing.md,
  },
  txIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMetaContainer: {
    flex: 1,
    gap: 2,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  txTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  txStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  listLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    borderTopWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  tabText: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '600',
  },
  qrFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: -12,
  },
  qrFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  qrFabText: {
    fontSize: 9,
    marginTop: 4,
    fontWeight: '700',
  },
});
