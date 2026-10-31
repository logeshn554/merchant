import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, Timestamp, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');
let env;
const emulatorPort = Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':').at(-1));
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-allgo', firestore: { host: '127.0.0.1', port: emulatorPort, rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'merchant'), { uid: 'merchant', name: 'Merchant', email: 'merchant@example.test', role: 'merchant', createdAt: '2026-10-24', walletBalance: 0, merchantId: 'main', merchantType: 'restaurant', merchantBusinessIds: { restaurant: ['branch_2'], grocery: [] } });
    await setDoc(doc(db, 'users', 'other'), { uid: 'other', name: 'Other', email: 'other@example.test', role: 'merchant', createdAt: '2026-10-24', walletBalance: 0, merchantId: 'other_main', merchantType: 'restaurant' });
    await setDoc(doc(db, 'users', 'staff_orders'), { uid: 'staff_orders', name: 'Order staff', email: 'orders@example.test', role: 'merchant', merchantStaffAccess: { branch_2: { merchantType: 'restaurant', ownerUid: 'merchant', permissions: ['orders'] } } });
    await setDoc(doc(db, 'users', 'staff_catalog'), { uid: 'staff_catalog', name: 'Catalog staff', email: 'catalog@example.test', role: 'merchant', merchantStaffAccess: { market_1: { merchantType: 'grocery', ownerUid: 'merchant', permissions: ['catalog'] } } });
    await setDoc(doc(db, 'bookings', 'branch_food'), { bookingId: 'branch_food', customerId: 'customer', merchantId: 'branch_2', serviceType: 'food', status: 'ready', paymentStatus: 'paid' });
    await setDoc(doc(db, 'bookings', 'branch_grocery'), { bookingId: 'branch_grocery', customerId: 'customer', merchantId: 'branch_2', serviceType: 'grocery', status: 'ready', paymentStatus: 'paid' });
    await setDoc(doc(db, 'bookings', 'staff_market_order'), { bookingId: 'staff_market_order', customerId: 'customer', merchantId: 'market_1', serviceType: 'grocery', status: 'ready', paymentStatus: 'paid' });
  });
});
const dbFor = uid => env.authenticatedContext(uid).firestore();

test('assigned merchant outlet access is type scoped for order reads and queries', async () => {
  const db = dbFor('merchant');
  await assertSucceeds(getDoc(doc(db, 'bookings', 'branch_food')));
  await assertSucceeds(getDocs(query(collection(db, 'bookings'), where('merchantId', '==', 'branch_2'), where('serviceType', '==', 'food'))));
  await assertFails(getDoc(doc(db, 'bookings', 'branch_grocery')));
  await assertFails(getDoc(doc(dbFor('other'), 'bookings', 'branch_food')));
});

test('merchant cannot forge outlet assignments in its user profile', async () => {
  await assertFails(updateDoc(doc(dbFor('merchant'), 'users', 'merchant'), { merchantBusinessIds: { restaurant: ['forged'], grocery: [] } }));
});
test('merchant staff can access only their granted outlet permissions and cannot edit their own grants', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'merchant_balances/branch_2'), { merchantId: 'branch_2', serviceType: 'food', availableCents: 5000, reservedCents: 0 });
    await setDoc(doc(db, 'grocery_stores/market_1/products/item/stock_events/reservation'), { kind: 'reservation', delta: -1, createdAt: '2026-10-24T00:00:00.000Z' });
  });
  await assertSucceeds(getDoc(doc(dbFor('staff_orders'), 'bookings/branch_food')));
  await assertFails(getDoc(doc(dbFor('staff_orders'), 'merchant_balances/branch_2')));
  await assertFails(getDoc(doc(dbFor('staff_orders'), 'bookings/branch_grocery')));
  await assertFails(updateDoc(doc(dbFor('staff_orders'), 'users/staff_orders'), { merchantStaffAccess: {} }));
  await assertSucceeds(getDoc(doc(dbFor('staff_catalog'), 'grocery_stores/market_1/products/item/stock_events/reservation')));
  await assertFails(getDoc(doc(dbFor('staff_catalog'), 'bookings/staff_market_order')));
  await assertFails(getDoc(doc(dbFor('staff_catalog'), 'grocery_stores/other/products/item/stock_events/reservation')));
});
test('notification history is private and users can change only its read marker', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'user_notifications/customer/items/event-1'), { id: 'event-1', title: 'Order update', body: 'Status changed', createdAt: Timestamp.now(), readAt: null, deliveryStatus: 'sent' });
  });
  const owned = doc(dbFor('customer'), 'user_notifications/customer/items/event-1');
  await assertSucceeds(getDoc(owned));
  await assertFails(getDoc(doc(dbFor('other'), 'user_notifications/customer/items/event-1')));
  await assertSucceeds(updateDoc(owned, { readAt: Timestamp.now() }));
  await assertFails(updateDoc(owned, { title: 'Forged notification' }));
  await assertFails(setDoc(doc(dbFor('customer'), 'user_notifications/customer/items/forged'), { title: 'Forged notification' }));
  await assertFails(deleteDoc(owned));
});
test('merchant settlement balances and entries are owner scoped and server written', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'merchant_balances/branch_2'), { merchantId: 'branch_2', merchantType: 'restaurant', currency: 'INR', availableCents: 5000, reservedCents: 0 });
    await setDoc(doc(db, 'merchant_ledger/branch_2/entries/order_1'), { merchantId: 'branch_2', serviceType: 'food', bookingId: 'order_1', payableCents: 5000 });
    await setDoc(doc(db, 'merchant_settlement_orders/order_1'), { bookingId: 'order_1', merchantId: 'branch_2', serviceType: 'food', contract: { commissionBps: 875, acceptedBy: 'merchant' } });
  });
  const merchantDb = dbFor('merchant');
  const balance = doc(merchantDb, 'merchant_balances/branch_2');
  const entry = doc(merchantDb, 'merchant_ledger/branch_2/entries/order_1');
  await assertSucceeds(getDoc(balance));
  await assertSucceeds(getDoc(entry));
  await assertFails(getDoc(doc(merchantDb, 'merchant_settlement_orders/order_1')));
  await assertFails(getDoc(doc(dbFor('other'), 'merchant_balances/branch_2')));
  await assertFails(getDoc(doc(dbFor('other'), 'merchant_ledger/branch_2/entries/order_1')));
  await assertFails(setDoc(doc(merchantDb, 'merchant_ledger/branch_2/entries/forged'), { merchantId: 'branch_2', serviceType: 'food', payableCents: 900000 }));
  await assertFails(updateDoc(balance, { availableCents: 900000 }));
});
