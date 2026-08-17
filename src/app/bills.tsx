import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';

import * as api from '../services/api';

const { width } = Dimensions.get('window');

interface Bill {
  id: string;
  billerName: string;
  receiverUsername: string;
  accountLabel: string;
  accountNo: string;
  dueDate?: string;
  paidDate?: string;
  amount: number;
  iconName: any;
  iconBg: string;
  iconColor: string;
  status: 'pending' | 'paid';
}

// MOCK DATA — replace with real /bills API later
const INITIAL_PENDING_BILLS: Bill[] = [
  {
    id: 'bill-1',
    billerName: 'DPDC Electricity',
    receiverUsername: 'dpdc',
    accountLabel: 'Customer ID',
    accountNo: '1234567890',
    dueDate: '18 May 2026',
    amount: 1245.00,
    iconName: 'flash',
    iconBg: '#FFF9E6',
    iconColor: '#FF9500',
    status: 'pending',
  },
  {
    id: 'bill-2',
    billerName: 'WASA Water',
    receiverUsername: 'wasa',
    accountLabel: 'Account No',
    accountNo: '9876543210',
    dueDate: '20 May 2026',
    amount: 350.00,
    iconName: 'water',
    iconBg: '#E6F4FF',
    iconColor: '#00A4E4',
    status: 'pending',
  },
  {
    id: 'bill-3',
    billerName: 'Titas Gas',
    receiverUsername: 'titasgas',
    accountLabel: 'Customer ID',
    accountNo: '5566778899',
    dueDate: '22 May 2026',
    amount: 680.00,
    iconName: 'flame',
    iconBg: '#E6FFF2',
    iconColor: '#3BA53A',
    status: 'pending',
  },
  {
    id: 'bill-4',
    billerName: 'BTCL Landline',
    receiverUsername: 'btcl',
    accountLabel: 'Phone No',
    accountNo: '02-55001122',
    dueDate: '25 May 2026',
    amount: 299.00,
    iconName: 'call',
    iconBg: '#F5E6FF',
    iconColor: '#8F78FF',
    status: 'pending',
  },
];

const MOCK_PAID_BILLS: Bill[] = [
  {
    id: 'paid-1',
    billerName: 'DPDC Electricity',
    receiverUsername: 'dpdc',
    accountLabel: 'Customer ID',
    accountNo: '1234567890',
    paidDate: '10 Apr 2026',
    amount: 1150.00,
    iconName: 'flash',
    iconBg: '#FFF9E6',
    iconColor: '#FF9500',
    status: 'paid',
  },
  {
    id: 'paid-2',
    billerName: 'WASA Water',
    receiverUsername: 'wasa',
    accountLabel: 'Account No',
    accountNo: '9876543210',
    paidDate: '12 Apr 2026',
    amount: 320.00,
    iconName: 'water',
    iconBg: '#E6F4FF',
    iconColor: '#00A4E4',
    status: 'paid',
  },
];

export default function BillPayment() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Tab State: 'pending' or 'history'
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic Bills State to support testing empty state
  const [pendingBills, setPendingBills] = useState<Bill[]>(INITIAL_PENDING_BILLS);

  const handleTabSwitch = (tab: 'pending' | 'history') => {
    if (tab === activeTab) return;
    
    setIsLoading(true);
    setActiveTab(tab);

    // Simulate 500ms API fetch loading delay
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handlePayNow = async (bill: Bill) => {
    setIsLoading(true);
    try {
      await api.checkReceiver(bill.receiverUsername);
    } catch {
      // Continue anyway
    } finally {
      setIsLoading(false);
    }

    router.push({
      pathname: '/bill-confirm',
      params: {
        receiverUsername: bill.receiverUsername,
        billerName: bill.billerName,
        billerAccountNo: `${bill.accountLabel}: ${bill.accountNo}`,
        amount: bill.amount.toFixed(2),
      },
    });
  };

  const clearPendingBills = () => {
    setPendingBills([]);
  };

  const resetPendingBills = () => {
    setPendingBills(INITIAL_PENDING_BILLS);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Header title={t.billPayment} />

      {/* Segmented Tab Bar Control */}
      <View style={[styles.tabContainer, { backgroundColor: isDarkMode ? theme.backgroundElement : '#F5F5F7' }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pending' && [styles.tabButtonActive, { backgroundColor: theme.background, shadowColor: theme.text }]]}
          onPress={() => handleTabSwitch('pending')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'pending' && [styles.tabTextActive, { color: theme.primary }]]}>
            {t.pendingBillsTab}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && [styles.tabButtonActive, { backgroundColor: theme.background, shadowColor: theme.text }]]}
          onPress={() => handleTabSwitch('history')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, { color: theme.textSecondary }, activeTab === 'history' && [styles.tabTextActive, { color: theme.primary }]]}>
            {t.paymentHistoryTab}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dev Testing Toggles */}
      <View style={styles.devBar}>
        {activeTab === 'pending' && pendingBills.length > 0 && (
          <TouchableOpacity onPress={clearPendingBills} style={[styles.devButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.devText, { color: theme.textSecondary }]}>{t.testEmptyState}</Text>
          </TouchableOpacity>
        )}
        {activeTab === 'pending' && pendingBills.length === 0 && (
          <TouchableOpacity onPress={resetPendingBills} style={[styles.devButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="refresh-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.devText, { color: theme.textSecondary }]}>{t.restorePendingBills}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{t.loadingBills}</Text>
        </View>
      ) : activeTab === 'pending' ? (
        pendingBills.length === 0 ? (
          /* EMPTY STATE */
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Ionicons name="document-text-outline" size={48} color={isDarkMode ? '#555' : '#C6C5DB'} />
              <View style={[styles.crossBadge, { backgroundColor: theme.error }]}>
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t.noPendingInvoices}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {t.allCaughtUpBills}
            </Text>
          </View>
        ) : (
          /* PENDING LIST */
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pendingBills.map((bill) => (
              <View key={bill.id} style={[styles.billCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
                  <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? theme.backgroundElement : bill.iconBg }]}>
                    <Ionicons name={bill.iconName} size={22} color={bill.iconColor} />
                  </View>
                  <View style={styles.metaWrapper}>
                    <Text style={[styles.billerName, { color: theme.text }]}>{bill.billerName}</Text>
                    <Text style={[styles.accountText, { color: theme.textSecondary }]}>
                      {bill.accountLabel}: {bill.accountNo}
                    </Text>
                    <Text style={[styles.dueDateText, { color: theme.primary }]}>{t.dueDateLabel}: {bill.dueDate}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>{t.dueAmountLabel}</Text>
                    <Text style={[styles.amountValue, { color: theme.text }]}>
                      ৳ {bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.payButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                    onPress={() => handlePayNow(bill)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.payButtonText}>{t.payNowButton}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        /* PAYMENT HISTORY LIST */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_PAID_BILLS.map((bill) => (
            <View key={bill.id} style={[styles.billCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
                <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? theme.backgroundElement : bill.iconBg }]}>
                  <Ionicons name={bill.iconName} size={22} color={bill.iconColor} />
                </View>
                <View style={styles.metaWrapper}>
                  <Text style={[styles.billerName, { color: theme.text }]}>{bill.billerName}</Text>
                  <Text style={[styles.accountText, { color: theme.textSecondary }]}>
                    {bill.accountLabel}: {bill.accountNo}
                  </Text>
                  <Text style={[styles.paidDateText, { color: theme.success }]}>{t.paidOnLabel} {bill.paidDate}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={[styles.amountLabel, { color: theme.textSecondary }]}>{t.paidAmountLabel}</Text>
                  <Text style={[styles.amountValue, { color: theme.text }]}>
                    ৳ {bill.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#E6FFF0' }]}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                  <Text style={[styles.statusBadgeText, { color: theme.success }]}>{t.paidLabel}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  // Card styles
  billCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    padding: Spacing.lg,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1.5,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaWrapper: {
    flex: 1,
    gap: 2,
  },
  billerName: {
    fontSize: 16,
    fontWeight: '800',
  },
  accountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dueDateText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  paidDateText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  payButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Loading and Center Containers
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
  // Empty State Layout
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
  crossBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Dev utility bar
  devBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  devText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
