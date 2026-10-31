import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { Button } from '../components/Button';

interface ApprovalGuardScreenProps {
  user: any;
  onRefresh: () => void;
  onLogout: () => void;
}

export function ApprovalGuardScreen({ user, onRefresh, onLogout }: ApprovalGuardScreenProps) {
  const isRejected = user?.approvalStatus === 'rejected';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.iconBox, isRejected && { backgroundColor: theme.colors.roseLight }]}>
          <Text style={styles.iconText}>{isRejected ? '❌' : '⏳'}</Text>
        </View>

        <Text style={styles.title}>
          {isRejected ? 'Application Not Approved' : 'Application Under Review'}
        </Text>

        <Text style={styles.subtitle}>
          {isRejected
            ? `Your restaurant application was reviewed by AllGo Operations and could not be approved. Reason: ${user?.approvalReason || 'Document verification incomplete.'}`
            : 'Welcome to AllGo! Your merchant account is currently pending administrative review. Once our internal operations team verifies your restaurant documents, your kitchen dashboard and live ordering will become active.'}
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Account ID</Text>
            <Text style={styles.value}>{user?.uid || user?.id}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Restaurant</Text>
            <Text style={styles.value}>{user?.restaurantName || 'Registered Outlet'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Approval Status</Text>
            <Text style={[styles.statusText, { color: isRejected ? theme.colors.rose : theme.colors.amber }]}>
              {user?.approvalStatus || 'pending_approval'}
            </Text>
          </View>
        </View>

        <Button
          title="Check Approval Status"
          onPress={onRefresh}
          style={{ width: '100%', marginBottom: theme.spacing.sm }}
        />

        <Button
          title="Sign Out"
          variant="outline"
          onPress={onLogout}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.amberLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  value: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
