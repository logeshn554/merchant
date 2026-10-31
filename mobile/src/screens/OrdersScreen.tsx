import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { theme } from '../theme';
import { merchantApi } from '../api/client';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { PickupCodeDisplay } from '../components/PickupCodeDisplay';

interface OrdersScreenProps {
  onBack: () => void;
}

export function OrdersScreen({ onBack }: OrdersScreenProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  // Modals
  const [acceptModalOrder, setAcceptModalOrder] = useState<any | null>(null);
  const [prepTime, setPrepTime] = useState<number>(20);
  const [rejectModalOrder, setRejectModalOrder] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000); // Polling every 4s
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await merchantApi.getOrders();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching merchant orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    if (!acceptModalOrder) return;
    setActionBusy(true);
    try {
      // Accepting order with prep time IMMEDIATELY triggers driver dispatch on server!
      await merchantApi.acceptOrder(acceptModalOrder.id, prepTime);
      setAcceptModalOrder(null);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept order.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectModalOrder || !rejectReason.trim()) return;
    setActionBusy(true);
    try {
      await merchantApi.rejectOrder(rejectModalOrder.id, rejectReason.trim());
      setRejectModalOrder(null);
      setRejectReason('');
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not reject order.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    setActionBusy(true);
    try {
      await merchantApi.markReady(orderId);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not mark order ready.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSetPreparing = async (orderId: string) => {
    setActionBusy(true);
    try {
      await merchantApi.setPreparing(orderId);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kitchen Orders & Dispatch</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Syncing orders with backend...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🍳</Text>
          <Text style={styles.emptyTitle}>Kitchen is quiet</Text>
          <Text style={styles.emptySubtitle}>Incoming orders will alert here with sound and countdown timer.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {orders.map(order => {
            const isPlaced = order.order_status === 'placed';
            const isAccepted = order.order_status === 'accepted';
            const isPreparing = order.order_status === 'preparing';
            const isReady = order.order_status === 'ready_for_pickup';
            const isDriverAtStore = order.delivery_status === 'at_store';

            return (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  isPlaced && styles.orderCardPlaced,
                ]}
              >
                {/* Placed Alert Header */}
                {isPlaced && (
                  <View style={styles.newAlertHeader}>
                    <Text style={styles.newAlertText}>🔔 NEW INCOMING ORDER</Text>
                    <Text style={styles.timerText}>Accept within 2 mins</Text>
                  </View>
                )}

                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderNumber}>#{order.order_number || order.id.slice(0, 8)}</Text>
                    <Text style={styles.customerName}>Client: {order.customer_name} ({order.customer_phone || ''})</Text>
                    <Text style={styles.orderTime}>{new Date(order.created_at).toLocaleTimeString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Badge status={order.order_status} />
                    <Text style={styles.orderTotal}>₹{order.total}</Text>
                  </View>
                </View>

                {/* Driver Status Banner */}
                {order.driver_name ? (
                  <View style={[styles.driverBox, isDriverAtStore && styles.driverBoxAtStore]}>
                    <Text style={styles.driverText}>
                      🏍 {isDriverAtStore ? 'Rider has ARRIVED at restaurant' : `Assigned Rider: ${order.driver_name}`}
                    </Text>
                    <Text style={styles.driverSubtext}>
                      Delivery status: <Text style={{ fontWeight: '800' }}>{order.delivery_status}</Text>
                    </Text>
                  </View>
                ) : (
                  order.order_status !== 'placed' && order.order_status !== 'rejected' && order.order_status !== 'cancelled' && (
                    <View style={styles.dispatchSearchingBox}>
                      <Text style={styles.dispatchSearchingText}>
                        📡 Dispatch active: Finding nearest eligible delivery partner...
                      </Text>
                    </View>
                  )
                )}

                {/* Items List */}
                <View style={styles.itemsList}>
                  {(order.items || []).map((it: any, idx: number) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{it.quantity}x</Text>
                      <Text style={styles.itemName}>{it.name}</Text>
                      <Text style={styles.itemPrice}>₹{it.price * it.quantity}</Text>
                    </View>
                  ))}
                </View>

                {/* Show Pickup Code once food is ready */}
                {(isReady || order.pickup_code) && order.order_status !== 'placed' && (
                  <PickupCodeDisplay code={order.pickup_code} />
                )}

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  {isPlaced && (
                    <>
                      <Button
                        title="Accept & Dispatch"
                        variant="primary"
                        onPress={() => setAcceptModalOrder(order)}
                        disabled={actionBusy}
                        style={{ flex: 1, marginRight: theme.spacing.sm }}
                      />
                      <Button
                        title="Reject"
                        variant="danger"
                        onPress={() => setRejectModalOrder(order)}
                        disabled={actionBusy}
                        style={{ width: 90 }}
                      />
                    </>
                  )}

                  {isAccepted && (
                    <Button
                      title="Start Food Preparation"
                      variant="primary"
                      onPress={() => handleSetPreparing(order.id)}
                      disabled={actionBusy}
                      style={{ flex: 1 }}
                    />
                  )}

                  {isPreparing && (
                    <Button
                      title="Mark Ready for Pickup (Show Code)"
                      variant="success"
                      onPress={() => handleMarkReady(order.id)}
                      disabled={actionBusy}
                      style={{ flex: 1 }}
                    />
                  )}

                  {isReady && (
                    <View style={styles.readyWaitingBox}>
                      <Text style={styles.readyWaitingText}>
                        Food is packed & ready. Awaiting rider pickup code verification.
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Accept Modal with Preparation Time (Auto-starts dispatch!) */}
      <Modal visible={Boolean(acceptModalOrder)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Order #{acceptModalOrder?.order_number}</Text>
            <Text style={styles.modalSubtitle}>
              Select estimated food preparation time. Delivery partner dispatch will start immediately so the rider arrives as the food is ready!
            </Text>

            <Text style={styles.modalSectionLabel}>Preparation Time Estimate:</Text>
            <View style={styles.prepOptionsRow}>
              {[15, 20, 25, 30, 40].map(mins => (
                <TouchableOpacity
                  key={mins}
                  onPress={() => setPrepTime(mins)}
                  style={[styles.prepChip, prepTime === mins && styles.prepChipActive]}
                >
                  <Text style={[styles.prepChipText, prepTime === mins && styles.prepChipTextActive]}>
                    {mins} mins
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setAcceptModalOrder(null)}
                style={{ flex: 1, marginRight: theme.spacing.sm }}
              />
              <Button
                title="Confirm & Start Dispatch"
                variant="primary"
                onPress={handleAcceptOrder}
                loading={actionBusy}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Modal with Mandatory Reason */}
      <Modal visible={Boolean(rejectModalOrder)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Order #{rejectModalOrder?.order_number}</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a valid rejection reason for the customer and operations audit log:
            </Text>

            <TextInput
              placeholder="e.g. Kitchen items out of stock or at max capacity"
              placeholderTextColor={theme.colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Back"
                variant="secondary"
                onPress={() => setRejectModalOrder(null)}
                style={{ flex: 1, marginRight: theme.spacing.sm }}
              />
              <Button
                title="Confirm Rejection"
                variant="danger"
                onPress={handleRejectOrder}
                disabled={!rejectReason.trim()}
                loading={actionBusy}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  orderCardPlaced: {
    borderColor: theme.colors.amber,
    borderWidth: 2,
    backgroundColor: '#0f172a',
  },
  newAlertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.amberLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.md,
  },
  newAlertText: {
    color: theme.colors.amber,
    fontSize: theme.fontSize.xs,
    fontWeight: '900',
  },
  timerText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  orderNumber: {
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.text,
  },
  customerName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  orderTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orderTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 4,
  },
  driverBox: {
    backgroundColor: theme.colors.blueLight,
    borderColor: theme.colors.blue,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  driverBoxAtStore: {
    backgroundColor: theme.colors.emeraldLight,
    borderColor: theme.colors.emerald,
  },
  driverText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.text,
  },
  driverSubtext: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dispatchSearchingBox: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  dispatchSearchingText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  itemsList: {
    borderTopColor: theme.colors.borderLight,
    borderTopWidth: 1,
    paddingTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemQty: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.primary,
    width: 24,
  },
  itemName: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    flex: 1,
  },
  itemPrice: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  readyWaitingBox: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  readyWaitingText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.emerald,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.xl,
    width: '100%',
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 18,
  },
  modalSectionLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  prepOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  prepChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  prepChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  prepChipText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  prepChipTextActive: {
    color: theme.colors.white,
  },
  reasonInput: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.sm,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
