import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { Spacing } from '../constants/theme';
import { syncService } from '../services/sync';

const { width } = Dimensions.get('window');

interface PopupData {
  title: string;
  message: string;
  isSuccess: boolean;
}

export function ReconciliationPopup() {
  const { theme, isDarkMode } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [popupData, setPopupData] = useState<PopupData | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    syncService.setReconciliationAlertCallback((alert) => {
      const isSuccess = alert.title.includes('সফল');
      setPopupData({
        title: alert.title,
        message: alert.message,
        isSuccess,
      });
      setVisible(true);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      syncService.setReconciliationAlertCallback(null);
    };
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setPopupData(null);
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    });
  };

  if (!popupData) return null;

  const accentColor = popupData.isSuccess ? theme.success : theme.error;
  const accentBg = popupData.isSuccess
    ? (isDarkMode ? 'rgba(9, 196, 135, 0.1)' : '#F3FBF7')
    : (isDarkMode ? 'rgba(255, 56, 56, 0.1)' : '#FFF5F5');
  const accentBorder = popupData.isSuccess
    ? (isDarkMode ? 'rgba(9, 196, 135, 0.3)' : '#D6F5E3')
    : (isDarkMode ? 'rgba(255, 56, 56, 0.3)' : '#FFD2D2');

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Accent top bar */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: accentBg, borderColor: accentBorder }]}>
            <Ionicons
              name={popupData.isSuccess ? 'checkmark-circle' : 'close-circle'}
              size={48}
              color={accentColor}
            />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>{popupData.title}</Text>

          {/* Message */}
          <Text style={[styles.message, { color: theme.textSecondary }]}>{popupData.message}</Text>

          {/* OK Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: accentColor }]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>ঠিক আছে</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 13, 44, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: width * 0.82,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  accentBar: {
    width: '100%',
    height: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  button: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    minWidth: width * 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
