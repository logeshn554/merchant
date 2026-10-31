import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { theme } from './src/theme';
import { merchantApi } from './src/api/client';
import { AuthScreen } from './src/screens/AuthScreen';
import { ApprovalGuardScreen } from './src/screens/ApprovalGuardScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { SettlementsScreen } from './src/screens/SettlementsScreen';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'orders' | 'menu' | 'settlements'>('dashboard');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setLoading(true);
    try {
      const profile = await merchantApi.getProfile();
      setUser(profile?.role === 'merchant' ? profile : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Opening AllGo Merchant Hub...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor={theme.colors.background} />
        <AuthScreen onSuccess={profile => setUser(profile)} />
      </SafeAreaView>
    );
  }

  // Approval status guard: An unapproved merchant cannot accept real orders or publish storefront
  const isApproved = user.approvalStatus === 'approved' || user.status === 'approved';
  if (!isApproved) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" backgroundColor={theme.colors.background} />
        <ApprovalGuardScreen
          user={user}
          onRefresh={checkSession}
          onLogout={() => {
            merchantApi.logout();
            setUser(null);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={theme.colors.background} />

      {currentScreen === 'dashboard' && (
        <DashboardScreen
          user={user}
          onOpenOrders={() => setCurrentScreen('orders')}
          onOpenMenu={() => setCurrentScreen('menu')}
          onOpenSettlements={() => setCurrentScreen('settlements')}
          onLogout={() => {
            merchantApi.logout();
            setUser(null);
          }}
        />
      )}

      {currentScreen === 'orders' && (
        <OrdersScreen onBack={() => setCurrentScreen('dashboard')} />
      )}

      {currentScreen === 'menu' && (
        <MenuScreen onBack={() => setCurrentScreen('dashboard')} />
      )}

      {currentScreen === 'settlements' && (
        <SettlementsScreen onBack={() => setCurrentScreen('dashboard')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
});
