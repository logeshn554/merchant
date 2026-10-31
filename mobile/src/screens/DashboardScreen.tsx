import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { merchantApi } from '../api/client';

interface DashboardScreenProps {
  user: any;
  onOpenOrders: () => void;
  onOpenMenu: () => void;
  onOpenSettlements: () => void;
  onLogout: () => void;
}

export function DashboardScreen({
  user,
  onOpenOrders,
  onOpenMenu,
  onOpenSettlements,
  onLogout,
}: DashboardScreenProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [settlement, setSettlement] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settlementRes, ordersRes] = await Promise.all([
        merchantApi.getSettlements().catch(() => null),
        merchantApi.getOrders().catch(() => []),
      ]);
      setSettlement(settlementRes);
      setOrders(ordersRes);
    } catch (err) {
      console.error('Error loading dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = orders.filter(o => o.order_status === 'placed').length;
  const activeCount = orders.filter(o => ['accepted', 'preparing', 'ready_for_pickup'].includes(o.order_status)).length;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.outletLabel}>RESTAURANT OUTLET</Text>
          <Text style={styles.outletName}>{user?.restaurantName || 'Spice Symphony'}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Open / Closed Availability Toggle */}
        <View style={[styles.statusCard, !isOpen && styles.statusCardClosed]}>
          <View style={{ flex: 1 }}>
            <View style={styles.statusIndicatorRow}>
              <View style={[styles.statusDot, !isOpen && styles.statusDotClosed]} />
              <Text style={styles.statusTitle}>
                {isOpen ? 'RESTAURANT IS OPEN' : 'RESTAURANT IS CLOSED'}
              </Text>
            </View>
            <Text style={styles.statusDesc}>
              {isOpen
                ? 'Visible on customer app. Receiving food delivery orders.'
                : 'Storefront paused. Customer ordering is temporarily disabled.'}
            </Text>
          </View>
          <Switch
            value={isOpen}
            onValueChange={setIsOpen}
            trackColor={{ false: theme.colors.surfaceElevated, true: theme.colors.primary }}
            thumbColor={theme.colors.white}
          />
        </View>

        {/* Quick Order Action Alerts */}
        {pendingCount > 0 && (
          <TouchableOpacity onPress={onOpenOrders} style={styles.pendingAlertBanner}>
            <Text style={styles.pendingAlertIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingAlertTitle}>{pendingCount} NEW ORDER WAITING</Text>
              <Text style={styles.pendingAlertSub}>Tap to accept order and start preparation</Text>
            </View>
            <Text style={styles.pendingAlertArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Performance Metrics */}
        <Text style={styles.sectionHeading}>Business Today</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Active Kitchen Orders</Text>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statSub}>In prep or ready</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Completed Today</Text>
            <Text style={styles.statValue}>{settlement?.summary?.total_orders || 0}</Text>
            <Text style={styles.statSub}>Delivered</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Gross Sales</Text>
            <Text style={[styles.statValue, { color: theme.colors.emerald }]}>
              ₹{settlement?.summary?.gross_sales || 0}
            </Text>
            <Text style={styles.statSub}>Food subtotal</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Net Payable (85%)</Text>
            <Text style={[styles.statValue, { color: theme.colors.primary }]}>
              ₹{settlement?.summary?.net_payable || 0}
            </Text>
            <Text style={styles.statSub}>After 15% commission</Text>
          </View>
        </View>

        {/* Operations Navigation Cards */}
        <Text style={styles.sectionHeading}>Kitchen Operations</Text>
        <TouchableOpacity onPress={onOpenOrders} style={styles.navCard}>
          <Text style={styles.navCardIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>Orders & Dispatch</Text>
            <Text style={styles.navCardSub}>Manage kitchen preparation, timers & driver pickup codes</Text>
          </View>
          <Text style={styles.navCardArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenMenu} style={styles.navCard}>
          <Text style={styles.navCardIcon}>🍲</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>Menu & Stock Availability</Text>
            <Text style={styles.navCardSub}>Toggle dishes in/out of stock and manage prices</Text>
          </View>
          <Text style={styles.navCardArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onOpenSettlements} style={styles.navCard}>
          <Text style={styles.navCardIcon}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>Settlements & Financial Reports</Text>
            <Text style={styles.navCardSub}>View weekly payout schedule and commission logs</Text>
          </View>
          <Text style={styles.navCardArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  outletLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  outletName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceElevated,
  },
  logoutText: {
    color: theme.colors.rose,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  statusCardClosed: {
    borderColor: theme.colors.rose,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.emerald,
    marginRight: 6,
  },
  statusDotClosed: {
    backgroundColor: theme.colors.rose,
  },
  statusTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  statusDesc: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    paddingRight: theme.spacing.md,
  },
  pendingAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.amberLight,
    borderColor: theme.colors.amber,
    borderWidth: 1.5,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  pendingAlertIcon: {
    fontSize: 22,
    marginRight: theme.spacing.md,
  },
  pendingAlertTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
    color: theme.colors.amber,
  },
  pendingAlertSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pendingAlertArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.amber,
  },
  sectionHeading: {
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statBox: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
    color: theme.colors.text,
    marginVertical: 4,
  },
  statSub: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  navCardIcon: {
    fontSize: 26,
    marginRight: theme.spacing.md,
  },
  navCardTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.text,
  },
  navCardSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  navCardArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
});
