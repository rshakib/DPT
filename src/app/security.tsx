import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Animated,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { saveDuressPinHash, hasDuressPin, DURESS_LIMIT_DEFAULT } from '../utils/security';

const { width } = Dimensions.get('window');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function SecurityCenter() {
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  // Local States
  const [score, setScore] = useState(75);
  const [fingerprintEnabled, setFingerprintEnabled] = useState(true);
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Score Animation
  const animatedScore = useRef(new Animated.Value(75)).current;

  useEffect(() => {
    const listenerId = animatedScore.addListener(({ value }) => {
      setScore(Math.round(value));
    });
    return () => {
      animatedScore.removeListener(listenerId);
    };
  }, [animatedScore]);

  // Circumference for r=90 circle is 2 * PI * r ≈ 565.48
  const strokeDashoffset = animatedScore.interpolate({
    inputRange: [0, 100],
    outputRange: [565.48, 0],
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastVisible(false);
    });
  };

  const handleImproveScore = () => {
    Animated.timing(animatedScore, {
      toValue: 100,
      duration: 1200,
      useNativeDriver: false, // SVG styling doesn't support Native Driver
    }).start();

    setFaceIdEnabled(true);
    triggerToast(t.scoreOptimized || 'Security score maximized!');

    // MOCK — real security score calculation happens server-side later
  };

  const handlePinChangePress = () => {
    Alert.alert(
      t.pinTitle || 'Change Security PIN',
      t.pinMessage || 'For your security, PIN changes can only be done at your bank branch. Please visit your nearest branch with your NID to update your PIN.',
      [{ text: t.ok || 'OK' }]
    );
  };

  const { user, isDuressMode } = useAuth();
  const [duressPin, setDuressPin] = useState('');
  const [duressConfigured, setDuressConfigured] = useState(false);
  const [showDuressInput, setShowDuressInput] = useState(false);
  const [duressJustSaved, setDuressJustSaved] = useState(false);

  useEffect(() => {
    if (user?.username) {
      hasDuressPin(user.username).then(setDuressConfigured);
    }
  }, [user?.username]);

  const handleSaveDuress = async () => {
    if (!user?.username) return;
    if (!/^\d{5}$/.test(duressPin)) {
      Alert.alert(
        language === 'en' ? 'Duress PIN' : 'ডিউরেস পিন',
        language === 'en' ? 'Enter exactly 5 digits.' : 'ঠিক ৫ ডিজিট লিখুন।'
      );
      return;
    }
    const ok = await saveDuressPinHash(user.username, duressPin);
    setDuressPin('');
    if (ok) {
      setDuressConfigured(true);
      setDuressJustSaved(true);
      setShowDuressInput(false);
      triggerToast(language === 'en' ? 'Duress PIN saved' : 'ডিউরেস পিন সংরক্ষিত');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Header title={t.securityCenterTitle || "Security Center"} />

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Security Score Widget Card */}
        <View style={[styles.gaugeCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.gaugeContainer}>
            <Svg width={180} height={180} viewBox="0 0 200 200">
              {/* Background circular track */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke={isDarkMode ? '#2C2754' : '#F0EEFA'}
                strokeWidth="10"
                fill="transparent"
              />
              {/* Animated Progress circular track */}
              <AnimatedCircle
                cx="100"
                cy="100"
                r="90"
                stroke={score === 100 ? theme.success : theme.primary}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray="565.48"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90, 100, 100)"
              />
            </Svg>

            {/* Inner Gauge Text content */}
            <View style={styles.gaugeTextWrapper}>
              <Text style={[styles.gaugeValue, { color: score === 100 ? theme.success : theme.primary }]}>
                {score}%
              </Text>
              <Text style={[styles.gaugeLabel, { color: theme.textSecondary }]}>
                {score === 100 ? (t.optimized || 'Optimized') : (t.protected || 'Protected')}
              </Text>
            </View>
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.primary },
              score === 100 && { backgroundColor: theme.success, shadowOpacity: 0, elevation: 0 },
            ]}
            onPress={handleImproveScore}
            disabled={score === 100}
            activeOpacity={0.8}
          >
            <Ionicons
              name={score === 100 ? 'checkmark-circle-sharp' : 'shield-checkmark-outline'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>
              {score === 100 ? (t.scoreOptimized || 'Score Optimized') : (t.improveScore || 'Improve Score')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security Settings List Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.securitySettings || 'Security Settings'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            {t.manageAuthOptions || 'Manage authorization options'}
          </Text>
        </View>

        {/* Duress PIN (paper §3.1) — unlocks a restricted profile via a separate key */}
        <View style={[styles.settingsCard, { backgroundColor: theme.cardBg, borderColor: theme.border, padding: Spacing.lg, marginBottom: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 4 }]}>
            {language === 'en' ? 'Duress PIN' : 'ডিউরেস পিন'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
            {language === 'en'
              ? `Unlocks a restricted profile (৳${DURESS_LIMIT_DEFAULT}) with a separate signing key.`
              : `আলাদা সাইনিং কী দিয়ে সীমিত প্রোফাইল (৳${DURESS_LIMIT_DEFAULT}) আনলক করে।`}
          </Text>

          {/* In duress mode a pre-existing duress PIN is hidden ("not set"), UNLESS the
              user just saved one in this duress session (then show "saved"). */}
          {(duressConfigured && (!isDuressMode || duressJustSaved) && !showDuressInput) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                <Text style={{ color: theme.success, fontWeight: '700' }}>
                  {language === 'en' ? 'Already set' : 'সেট করা আছে'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDuressInput(true)} activeOpacity={0.8}>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>{t.change || 'Change'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 12,
                  paddingHorizontal: Spacing.md,
                  paddingVertical: 12,
                  color: theme.text,
                }}
                value={duressPin}
                onChangeText={(v) => setDuressPin(v.replace(/[^0-9]/g, '').slice(0, 5))}
                placeholder={language === 'en' ? 'Enter 5-digit duress PIN' : '৫ ডিজিটের ডিউরেস পিন'}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={5}
              />
              <TouchableOpacity
                style={{ backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: Spacing.lg, paddingVertical: 12 }}
                onPress={handleSaveDuress}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t.save || 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security Settings Options Card */}
        <View style={[styles.settingsCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {/* PIN Option Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#F3F0FF' }]}>
                <Ionicons name="lock-closed" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  {t.securityPin || 'Security PIN'}
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  {t.usedTxApprovals || 'Used for transaction approvals'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.changeLink, { backgroundColor: isDarkMode ? '#2C2754' : '#FAF9FF', borderColor: theme.border }]}
              onPress={handlePinChangePress}
              activeOpacity={0.7}
            >
              <Text style={[styles.changeLinkText, { color: theme.primary }]}>
                {t.change || 'Change'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

          {/* Fingerprint Toggle Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#F3F0FF' }]}>
                <Ionicons name="finger-print" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  {t.fingerprintLogin || 'Fingerprint Login'}
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  {t.authFingerprint || 'Authorize using your fingerprint'}
                </Text>
              </View>
            </View>
            <Switch
              value={fingerprintEnabled}
              onValueChange={setFingerprintEnabled}
              trackColor={{ false: isDarkMode ? '#1E1E1E' : '#ECE9FC', true: theme.primaryLight }}
              thumbColor={fingerprintEnabled ? theme.primary : '#C6C5DB'}
            />
          </View>

          <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

          {/* Face ID Toggle Row */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#2C2754' : '#F3F0FF' }]}>
                <Ionicons name="eye" size={20} color={theme.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>
                  {t.faceIdLogin || 'Face ID Login'}
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  {t.authFaceId || 'Authorize using facial recognition'}
                </Text>
              </View>
            </View>
            <Switch
              value={faceIdEnabled}
              onValueChange={setFaceIdEnabled}
              trackColor={{ false: isDarkMode ? '#1E1E1E' : '#ECE9FC', true: theme.primaryLight }}
              thumbColor={faceIdEnabled ? theme.primary : '#C6C5DB'}
            />
          </View>
        </View>
      </View>

      {/* Custom Success Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <View style={styles.toastCard}>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
  },
  // Circular Gauge Styling
  gaugeCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  gaugeContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  gaugeTextWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  gaugeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  actionButton: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    width: '85%',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Settings List Section
  sectionHeader: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  settingsCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  changeLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  changeLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1.5,
    marginLeft: 56,
  },
  // Custom success toast
  toastContainer: {
    position: 'absolute',
    bottom: Spacing.huge,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0E0D2C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    shadowColor: '#0E0D2C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
