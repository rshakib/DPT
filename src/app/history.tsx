import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Spacing } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import * as db from '../services/db';
import { syncService } from '../services/sync';
import { mapApiTransaction, MappedTransaction } from '../utils/transactionMapper';

const { width } = Dimensions.get('window');

export default function History() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const { user, logout } = useAuth();

  // Tab selections: 'all' | 'success' | 'failed'
  const [activeTab, setActiveTab] = useState<'all' | 'success' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch transactions from SQLite cache first, then trigger sync
  const fetchHistory = async () => {
    if (!user?.username) return;

    let hasCachedData = false;
    console.log(`[HISTORY] Fetching transactions for user: ${user.username}`);

    // 1. Instant read from SQLite cache
    try {
      const cached = await db.getCachedTransactions(user.username);
      if (cached && cached.length > 0) {
        console.log(`[HISTORY] SQLite Cache HIT (${cached.length} transactions)`);
        setRawTransactions(cached);
        setIsLoading(false);
        hasCachedData = true;
      }
    } catch (e) {
      console.warn('[HISTORY] Failed to read SQLite cache:', e);
    }

    if (!hasCachedData) {
      console.log('[HISTORY] SQLite cache MISS. Showing loading indicator...');
      setIsLoading(true);
    }
    setErrorMessage(null);

    // 2. Perform delta sync in background
    try {
      await syncService.deltaSync(user.username);
      let updated = await db.getCachedTransactions(user.username);

      // Fallback: If SQLite cache is still empty, fetch directly from API
      if (!updated || updated.length === 0) {
        console.log('[HISTORY] Fallback to direct API for transactions...');
        const txRes = await api.getTransactions(user.username);
        if (txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
          await db.saveCachedTransactions(user.username, txRes.data);
          updated = txRes.data;
        }
      }

      if (updated) {
        setRawTransactions(updated);
      }
    } catch (err: any) {
      console.error('[HISTORY] Error fetching history:', err);
      setErrorMessage(err.message || 'Failed to update transaction history.');
    } finally {
      console.log('[HISTORY] Clearing loading state in finally block');
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
      const unsubscribe = syncService.subscribe(async () => {
        if (user?.username) {
          const updated = await db.getCachedTransactions(user.username);
          setRawTransactions(updated);
        }
      });
      return () => {
        unsubscribe();
      };
    }, [user?.username])
  );

  // Handle Export CSV
  const handleExportCsv = () => {
    Alert.alert(
      t.exportCsv || 'Export CSV',
      t.exportStarted || 'CSV Export started successfully',
      [{ text: t.ok || 'OK' }]
    );
  };

  // Process and map raw API transactions
  const transactions = rawTransactions.map((tx: any) =>
    mapApiTransaction(tx, user?.username || '', t, language, theme)
  );

  // Filter transactions based on selected status tab
  const getFilteredTransactions = () => {
    if (activeTab === 'success') {
      return transactions.filter((tx) => tx.statusEnglish === 'Successful');
    }
    if (activeTab === 'failed') {
      return transactions.filter((tx) => tx.statusEnglish === 'Failed');
    }
    return transactions;
  };

  const handleCardPress = (tx: MappedTransaction) => {
    router.push({
      pathname: '/transaction-result',
      params: {
        status: tx.statusEnglish === 'Successful' ? 'success' : (tx.errorCode || 'failed'),
        receiverUsername: tx.receiver,
        amount: tx.amountVal.toString(),
        referenceNo: tx.referenceNo,
        dateTime: tx.time,
      },
    });
  };

  const filteredTx = getFilteredTransactions();

  console.log('[RENDER] History rendering: isLoading =', isLoading, ', rawTransactions.length =', rawTransactions.length);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Custom Integrated Header Row */}
      <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t.historyTitle || 'Transaction History'}
        </Text>
        
        <TouchableOpacity
          onPress={handleExportCsv}
          style={styles.headerExportBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="download-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Selector Tabs Row */}
      <View style={[styles.tabsRow, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FAF9FF', borderColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'all' && [styles.tabActive, { backgroundColor: theme.background }]
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[
            styles.tabText,
            { color: theme.textSecondary },
            activeTab === 'all' && { color: theme.primary, fontWeight: '700' }
          ]}>
            {t.allTab || 'All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'success' && [styles.tabActive, { backgroundColor: theme.background }]
          ]}
          onPress={() => setActiveTab('success')}
        >
          <Text style={[
            styles.tabText,
            { color: theme.textSecondary },
            activeTab === 'success' && { color: theme.primary, fontWeight: '700' }
          ]}>
            {t.successfulTab || 'Successful'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'failed' && [styles.tabActive, { backgroundColor: theme.background }]
          ]}
          onPress={() => setActiveTab('failed')}
        >
          <Text style={[
            styles.tabText,
            { color: theme.textSecondary },
            activeTab === 'failed' && { color: theme.primary, fontWeight: '700' }
          ]}>
            {t.failedTab || 'Failed'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main List Area */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t.loadingTransactions || 'Loading transactions...'}
          </Text>
        </View>
      ) : errorMessage ? (
        /* Error State view */
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={54} color={theme.error} />
          <Text style={[styles.emptyText, { color: theme.text, marginTop: Spacing.xs }]}>
            {language === 'en' ? 'Failed to load transaction history.' : 'লেনদেনের ইতিহাস লোড করতে ব্যর্থ হয়েছে।'}
          </Text>
          <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={fetchHistory}
          >
            <Text style={styles.retryButtonText}>
              {language === 'en' ? 'Retry' : 'পুনরায় চেষ্টা করুন'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : filteredTx.length === 0 ? (
        /* Empty State */
        <View style={styles.centerContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FAF9FF', borderColor: theme.border }]}>
            <Ionicons name="funnel-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyText, { color: theme.text }]}>
            {t.noTxCategory || 'No transactions recorded in this category'}
          </Text>
        </View>
      ) : (
        /* Scrollable Transaction List */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredTx.map((tx) => {
            const isTxSuccess = tx.statusEnglish === 'Successful';
            
            return (
              <TouchableOpacity
                key={tx.id}
                style={[styles.transactionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => handleCardPress(tx)}
                activeOpacity={0.8}
              >
                {/* Left side circular icon */}
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : tx.iconBg }]}>
                  <Ionicons name={tx.icon as any} size={20} color={isDarkMode ? theme.primary : tx.iconColor} />
                </View>

                {/* Meta details (Receiver/Type & Timestamp) */}
                <View style={styles.metaContainer}>
                  <Text style={[styles.receiverText, { color: theme.text }]} numberOfLines={1}>
                    {tx.title}
                  </Text>
                  <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                    {tx.time}
                  </Text>
                </View>

                {/* Right side details (Amount & Status Badge) */}
                <View style={styles.rightContainer}>
                  <Text style={[
                    styles.amountText,
                    { color: tx.isOutgoing ? theme.error : theme.success }
                  ]}>
                    {tx.amount}
                  </Text>
                  
                  {/* Small pill badge */}
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: isTxSuccess ? 'rgba(9, 196, 135, 0.08)' : 'rgba(255, 56, 56, 0.08)' }
                  ]}>
                    <Text style={[
                       styles.statusBadgeText,
                       { color: isTxSuccess ? theme.success : theme.error }
                    ]}>
                      {tx.status}
                    </Text>
                  </View>
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
  headerContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  headerExportBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    marginHorizontal: Spacing.xxl,
    marginVertical: Spacing.md,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    shadowColor: '#0E0D2C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.huge,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.huge,
    gap: Spacing.md,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaContainer: {
    flex: 1,
    gap: 3,
  },
  receiverText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  rightContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
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
