import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface BadgeProps {
  status: string;
}

export function Badge({ status }: BadgeProps) {
  const getBadgeStyle = () => {
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'approved':
      case 'verified':
        return { bg: theme.colors.emeraldLight, text: theme.colors.emerald };
      case 'preparing':
      case 'accepted':
      case 'assigned':
      case 'at_store':
      case 'picked_up':
      case 'transit':
      case 'at_customer':
        return { bg: theme.colors.blueLight, text: theme.colors.blue };
      case 'placed':
      case 'ready_for_pickup':
      case 'offering':
      case 'pending':
      case 'pending_approval':
      case 'pending_kyc':
        return { bg: theme.colors.amberLight, text: theme.colors.amber };
      case 'rejected':
      case 'cancelled':
        return { bg: theme.colors.roseLight, text: theme.colors.rose };
      default:
        return { bg: theme.colors.surfaceElevated, text: theme.colors.textSecondary };
    }
  };

  const { bg, text } = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radii.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
