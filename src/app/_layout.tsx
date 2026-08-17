import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet, InteractionManager } from 'react-native';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AppLockProvider, useAppLock } from '../context/AppLockContext';

function RootLayoutContent() {
  const { theme, isDarkMode } = useAppTheme();
  const { isAuthenticated, isInitializing } = useAuth();
  const { isLocked } = useAppLock();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isInitializing) return;

    const firstSegment = (segments[0] as string) || '';
    const inAuthGroup = firstSegment === 'login' || firstSegment === 'quick-unlock' || firstSegment === 'index' || firstSegment === 'create-password' || firstSegment === 'officer-verify';

    if (isAuthenticated) {
      if (isLocked && firstSegment !== 'quick-unlock') {
        InteractionManager.runAfterInteractions(() => {
          router.replace('/quick-unlock');
        });
      } else if (!isLocked && inAuthGroup) {
        InteractionManager.runAfterInteractions(() => {
          router.replace('/dashboard');
        });
      }
    } else {
      if (!inAuthGroup && firstSegment !== '') {
        InteractionManager.runAfterInteractions(() => {
          router.replace('/login');
        });
      }
    }
  }, [isAuthenticated, isInitializing, isLocked, segments]);

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="officer-verify" />
        <Stack.Screen name="biometric-enrollment" />
        <Stack.Screen name="create-password" />
        <Stack.Screen name="activation-success" />
        <Stack.Screen name="quick-unlock" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="send-money" />
        <Stack.Screen name="send-money-confirm" />
        <Stack.Screen name="cashout" />
        <Stack.Screen name="merchant" />
        <Stack.Screen name="merchant-confirm" />
        <Stack.Screen name="recharge" />
        <Stack.Screen name="recharge-confirm" />
        <Stack.Screen name="bills" />
        <Stack.Screen name="bill-confirm" />
        <Stack.Screen name="qr-pay" />
        <Stack.Screen name="qr-amount" />
        <Stack.Screen name="qr-pay-confirm" />
        <Stack.Screen name="history" />
        <Stack.Screen name="my-qr" />
        <Stack.Screen name="features" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="security" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="transaction-processing" />
        <Stack.Screen name="transaction-result" />
      </Stack>
    </SafeAreaProvider>
  );
}

const Sentry = {
  init: (..._args: any[]) => {},
  addBreadcrumb: (..._args: any[]) => {},
  captureException: (..._args: any[]) => {},
  wrap: (component: any) => component,
};

Sentry.init({
  dsn: '',
  enableNative: false,
  debug: false,
});

function RootLayout() {
  return (
    <AuthProvider>
      <AppLockProvider>
        <ThemeProvider>
          <LanguageProvider>
            <RootLayoutContent />
          </LanguageProvider>
        </ThemeProvider>
      </AppLockProvider>
    </AuthProvider>
  );
}

export default Sentry.wrap(RootLayout);
