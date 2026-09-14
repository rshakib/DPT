import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

export default function AboutDPT() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();

  const features = [
    {
      icon: 'people-outline' as const,
      title: language === 'en' ? 'For Everyone' : 'সবার জন্য',
      desc: language === 'en'
        ? 'Students, workers, business owners — anyone who needs simple payments'
        : 'ছাত্র, শ্রমিক, ব্যবসায়ী — যে কেউ সহজে পেমেন্ট করতে পারে',
    },
    {
      icon: 'cloud-offline-outline' as const,
      title: language === 'en' ? 'Works Offline' : 'অফলাইনে কাজ করে',
      desc: language === 'en'
        ? 'No internet? No problem. Pay anytime, anywhere.'
        : 'ইন্টারনেট নেই? সমস্যা নেই। যেকোনো সময়, যেকোনো জায়গায় পেমেন্ট করুন।',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: language === 'en' ? 'Secure' : 'নিরাপদ',
      desc: language === 'en'
        ? 'Bank-grade encryption keeps your money safe'
        : 'ব্যাংক-গ্রেড এনক্রিপশন আপনার টাকা নিরাপদ রাখে',
    },
    {
      icon: 'flash-outline' as const,
      title: language === 'en' ? 'Instant' : 'তাৎক্ষণিক',
      desc: language === 'en'
        ? 'Send money in seconds with NFC tap or QR scan'
        : 'NFC ট্যাপ বা QR স্ক্যান দিয়ে সেকেন্ডেই টাকা পাঠান',
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={language === 'en' ? 'About DPT' : 'DPT সম্পর্কে'} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>DPT</Text>
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>
            Digital Pocket Transaction
          </Text>
          <Text style={[styles.version, { color: theme.textSecondary }]}>
            Version 2.0
          </Text>
        </View>

        {/* Mission */}
        <View style={[styles.missionCard, { backgroundColor: theme.primary }]}>
          <Ionicons name="flag" size={24} color="#FFFFFF" />
          <Text style={styles.missionTitle}>
            {language === 'en' ? 'Our Mission' : 'আমাদের লক্ষ্য'}
          </Text>
          <Text style={styles.missionText}>
            {language === 'en'
              ? 'Make Bangladesh cashless — one transaction at a time.'
              : 'বাংলাদেশকে নগদমুক্ত করুন — একটি লেনদেনে একবার।'}
          </Text>
        </View>

        {/* Features */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {language === 'en' ? 'Why DPT?' : 'কেন DPT?'}
        </Text>

        <View style={styles.featuresGrid}>
          {features.map((item, index) => (
            <View
              key={index}
              style={[styles.featureCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name={item.icon} size={22} color={theme.primary} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>
                {item.desc}
              </Text>
            </View>
          ))}
        </View>

        {/* Developer Info */}
        <View style={[styles.devCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Ionicons name="school-outline" size={28} color={theme.primary} />
          <Text style={[styles.devTitle, { color: theme.text }]}>
            {language === 'en' ? 'Developed By' : 'ডেভেলপ করেছেন'}
          </Text>
          <Text style={[styles.devName, { color: theme.text }]}>
            Department of Computer Science and Engineering
          </Text>
          <Text style={[styles.devUni, { color: theme.textSecondary }]}>
            United International University, Dhaka
          </Text>
        </View>

        {/* Contact */}
        <View style={[styles.contactCard, { backgroundColor: isDarkMode ? '#1A1B20' : '#F7F6FF', borderColor: theme.border }]}>
          <Ionicons name="mail-outline" size={20} color={theme.primary} />
          <Text style={[styles.contactText, { color: theme.textSecondary }]}>
            support@dpt-banking.com
          </Text>
        </View>

        {/* Copyright */}
        <Text style={[styles.copyright, { color: theme.textSecondary }]}>
          © 2026 DPT. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
  },
  version: {
    fontSize: 13,
    marginTop: 4,
  },

  // Mission
  missionCard: {
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  missionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  missionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
    opacity: 0.95,
  },

  // Features
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
  },
  featureCard: {
    width: (width - Spacing.xxl * 2 - Spacing.md) / 2,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  // Developer
  devCard: {
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  devTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.sm,
    color: '#888',
  },
  devName: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  devUni: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },

  // Contact
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  contactText: {
    fontSize: 14,
  },

  // Copyright
  copyright: {
    fontSize: 12,
    textAlign: 'center',
  },
});
