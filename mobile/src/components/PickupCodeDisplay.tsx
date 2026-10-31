import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface PickupCodeDisplayProps {
  code: string;
}

export function PickupCodeDisplay({ code }: PickupCodeDisplayProps) {
  if (!code) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Food Handover Pickup Code</Text>
      <Text style={styles.subtitle}>
        Show this 4-digit verification code to the delivery partner when handing over the food package:
      </Text>
      <View style={styles.codeRow}>
        {code.split('').map((char, idx) => (
          <View key={idx} style={styles.digitBox}>
            <Text style={styles.digitText}>{char}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        The driver must enter this code in their app to verify pickup and proceed to delivery.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.amberLight,
    borderColor: theme.colors.amber,
    borderWidth: 1.5,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  digitBox: {
    width: 48,
    height: 56,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.amber,
    borderWidth: 1.5,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.amber,
    fontFamily: 'monospace',
  },
  note: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
