import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { merchantApi } from '../api/client';

interface SettlementsScreenProps {
  onBack: () => void;
}

export function SettlementsScreen({ onBack }: SettlementsScreenProps) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettlements();
  }, []);

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const res = await merchantApi.getSettlements();
      setData(res);
    } catch (err) {
      console.error('Failed to load settlements', err);
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary || {};

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settlements & Financials</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Calculating payout records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Main Net Balance Card */}
          <View style={styles.netCard}>
            <Text style={styles.netLabel}>CURRENT NET PAYABLE</Text>
            <Text style={styles.netAmount}>₹{Number(summary.net_payable || 0).toLocaleString('en-IN')}</Text>
            <View style={styles.cycleBadge}>
              <Text style={styles.cycleText}>Cycle: {data?.settlementCycle || 'Weekly on Monday'}</Text>
            </View>
          </View>

          {/* Breakdown Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Financial Breakdown</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Fulfilled Delivered Orders</Text>
              <Text style={styles.val}>{summary.total_orders || 0}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Gross Food Sales</Text>
              <Text style={styles.val}>₹{Number(summary.gross_sales || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>AllGo Platform Commission (15%)</Text>
              <Text style={[styles.val, { color: theme.colors.rose }]}>
                -₹{Number(summary.platform_commission || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Net Settlement</Text>
              <Text style={styles.totalVal}>₹{Number(summary.net_payable || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>

          {/* Policy Information */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Payout Policy</Text>
            <Text style={styles.policyText}>
              • Settlements are computed server-side from confirmed delivered food orders.{'\n'}
              • Standard 15% platform commission covers driver dispatch and customer support.{'\n'}
              • Direct bank transfer is disbursed every Monday at 02:00 AM UTC.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 22,
    color: theme.colors.text,
  },
  headerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    padding: theme.spacing.lg,
  },
  netCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  netLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  netAmount: {
    fontSize: theme.fontSize.display,
    fontWeight: '900',
    color: theme.colors.text,
    marginVertical: theme.spacing.xs,
  },
  cycleBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radii.full,
  },
  cycleText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cardHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: theme.colors.borderLight,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  val: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  totalRow: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '900',
    color: theme.colors.text,
  },
  totalVal: {
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.emerald,
  },
  policyText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.sm,
  },
});
