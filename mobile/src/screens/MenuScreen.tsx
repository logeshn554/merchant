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

interface MenuScreenProps {
  onBack: () => void;
}

export function MenuScreen({ onBack }: MenuScreenProps) {
  const [menu, setMenu] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    setLoading(true);
    try {
      const data = await merchantApi.getMenu();
      setMenu(data);
    } catch (err) {
      console.error('Failed to load menu', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = (itemId: string) => {
    setMenu(prev =>
      prev.map(it => (it.id === itemId ? { ...it, available: !it.available } : it))
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu & Stock Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching menu catalog...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.subtext}>
            Toggle items on or off. Out-of-stock items are instantly hidden from customer ordering.
          </Text>

          {menu.map(item => {
            const isAvail = item.available !== false;

            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category} · ₹{item.price}</Text>
                  {item.description ? (
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.switchBox}>
                  <Text style={[styles.stockStatus, { color: isAvail ? theme.colors.emerald : theme.colors.rose }]}>
                    {isAvail ? 'IN STOCK' : 'OUT OF STOCK'}
                  </Text>
                  <Switch
                    value={isAvail}
                    onValueChange={() => toggleAvailability(item.id)}
                    trackColor={{ false: theme.colors.surfaceElevated, true: theme.colors.primary }}
                    thumbColor={theme.colors.white}
                  />
                </View>
              </View>
            );
          })}
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
  subtext: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.text,
  },
  itemCategory: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    marginTop: 2,
  },
  itemDesc: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  switchBox: {
    alignItems: 'center',
  },
  stockStatus: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
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
