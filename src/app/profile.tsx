import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing } from '../constants/theme';
import { Header } from '../components/Header';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { translations } from '../constants/translations';
import { useAuth } from '../context/AuthContext';
import { saveProfileImage, getProfileImage, getDisplayName } from '../services/db';
import * as api from '../services/api';

const { width } = Dimensions.get('window');

interface MenuItem {
  title: string;
  subtitle?: string;
  iconName: any;
  iconBg: string;
  iconColor: string;
  route?: string;
  action?: () => void;
  isDestructive?: boolean;
}

export default function Profile() {
  const router = useRouter();
  const { theme, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const t = translations[language];

  const { logout, user } = useAuth();

  const userHandle = user?.username ? `@${user.username}` : '';

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayNameState, setDisplayNameState] = useState(user?.full_name || user?.username || 'User');

  // Load profile image
  useEffect(() => {
    const loadData = async () => {
      if (user?.username) {
        // Try SQLite first (fast, offline)
        const img = await getProfileImage(user.username);
        if (img) {
          setProfileImage(img);
        } else {
          // Try DB1 (server) if not in SQLite
          try {
            const res = await api.getProfilePicture(user.username);
            if (res.success && res.data?.imageData) {
              setProfileImage(res.data.imageData);
              // Also save to SQLite for offline access
              await saveProfileImage(user.username, res.data.imageData);
            }
          } catch (e) {
            // Offline or error — no picture available
          }
        }
        // Use full_name from user object (set during login)
        if (user.full_name) {
          setDisplayNameState(user.full_name);
        }
      }
    };
    loadData();
  }, [user?.username, user?.full_name]);

  const userName = displayNameState;

  const handleCameraPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        language === 'en' ? 'Permission Required' : 'অনুমতি প্রয়োজন',
        language === 'en' ? 'Please grant photo library access to set a profile picture.' : 'প্রোফাইল ছবি সেট করতে ফটো লাইব্রেরি অ্যাক্সেস দিন।'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const base64 = asset.base64;
      if (base64 && user?.username) {
        setProfileImage(base64);
        // Save to SQLite (local)
        await saveProfileImage(user.username, base64);
        // Sync to DB1 (server) in background
        api.saveProfilePicture(user.username, base64).catch((e) =>
          console.warn('[PROFILE] Failed to sync picture to DB1:', e)
        );
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.warn('Logout failed:', err);
    }
  };

  const triggerLogoutAlert = () => {
    Alert.alert(
      t.logoutConfirmTitle || 'Logout',
      t.logoutConfirmMsg || 'Are you sure you want to logout?',
      [
        { text: t.cancel || 'Cancel', style: 'cancel' },
        { text: t.logout || 'Logout', style: 'destructive', onPress: handleLogout },
      ]
    );
  };

  // Group 1: General Info Settings
  const group1Items: MenuItem[] = [
    {
      title: 'Personal Information',
      iconName: 'person-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
    {
      title: 'My Accounts',
      iconName: 'business-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
    {
      title: 'Payment Methods',
      iconName: 'card-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
    {
      title: 'Transaction Limits',
      iconName: 'document-text-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
  ];

  // Group 2: App & Privacy Configuration
  const group2Items: MenuItem[] = [
    {
      title: t.securityCenterTitle || 'Security Center',
      subtitle: 'Manage security settings and privacy',
      iconName: 'shield-checkmark-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
      route: '/security',
    },
    {
      title: t.settingsTitle || 'Settings',
      subtitle: 'Customize your app preferences',
      iconName: 'settings-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
      route: '/settings',
    },
    {
      title: 'Notifications',
      iconName: 'notifications-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
      route: '/notifications',
    },
    {
      title: 'Help & Support',
      iconName: 'help-circle-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
    {
      title: 'About DPT',
      iconName: 'information-circle-outline',
      iconBg: isDarkMode ? '#2C2754' : '#FAF9FF',
      iconColor: theme.primary,
    },
  ];

  const handleItemPress = (item: MenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.route) {
      router.push(item.route as any);
    } else {
      Alert.alert(item.title, `Placeholder for ${item.title} section.`);
    }
  };

  const renderGroup = (items: MenuItem[]) => {
    return (
      <View style={[styles.menuGroupCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <View key={item.title}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.iconName} size={20} color={item.iconColor} />
                </View>
                
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
                  )}
                </View>

                <Ionicons name="chevron-forward" size={18} color="#C6C5DB" />
              </TouchableOpacity>
              
              {!isLast && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <Header title={t.profile || "Profile"} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar Frame */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#1E1E1E' : '#FAF9FF', borderColor: theme.border }]}>
              {profileImage ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${profileImage}` }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={64} color="#C6C5DB" />
              )}
            </View>
            <TouchableOpacity
              style={[styles.cameraBadge, { backgroundColor: theme.primary }]}
              onPress={handleCameraPress}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>{userName}</Text>
          <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>{userHandle}</Text>
        </View>

        {/* Menu Cards */}
        <View style={styles.menuContainer}>
          {/* Group 1 Cards */}
          {renderGroup(group1Items)}

          {/* Group 2 Cards */}
          {renderGroup(group2Items)}

          {/* Group 3: Logout Group Card */}
          <View style={[styles.menuGroupCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={triggerLogoutAlert}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, styles.logoutIconCircle, { backgroundColor: isDarkMode ? '#2C1D24' : '#FFF0F0' }]}>
                <Ionicons name="log-out-outline" size={20} color={theme.error} />
              </View>

              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, styles.logoutTitle, { color: theme.error }]}>{t.logout || "Logout"}</Text>
                <Text style={[styles.itemSubtitle, { color: theme.textSecondary }]}>{t.logoutSubtitle || "Log out from your account safely"}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={theme.error} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: Spacing.huge,
  },
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0E0D2C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  profileHandle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Menu styling
  menuContainer: {
    gap: Spacing.lg,
  },
  menuGroupCard: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIconCircle: {
    // base styling overridden by dynamic background
  },
  itemTextContainer: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutTitle: {
    // color overridden dynamically
  },
  itemSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1.5,
    marginLeft: 56, // aligns under the text rather than under the icon
  },
});
