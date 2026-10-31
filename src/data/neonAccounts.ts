import { accountRequest, getAccount, pollAccount, updateAccount, serviceAccessError } from '../accounts';
import { deletionRequestServiceIdentityError } from '../app/serviceAccess';

const own = (_uid: string) => getAccount(); // The API derives ownership from the verified session.
export const neonAccountHandlers: Record<string, (...args: any[]) => any> = {
  exportAccountPage: (section, cursor) => accountRequest(`/account/export?section=${encodeURIComponent(section)}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`),
  getOrCreateUserProfile: own,
  saveAccountName: (_uid, name) => updateAccount({ name }),
  updateUserPreferences: (_uid, preferences) => updateAccount({ preferences }),
  updateUserFavorites: (_uid, favorites) => updateAccount({ favorites }),
  updateUserAddress: (_uid, defaultAddress, defaultAddressId = '') => updateAccount({ defaultAddress, defaultAddressId }),
  listenToAccountProfile: (_uid, callback, error) => pollAccount('/account', callback, error),
  listenToSavedAddresses: (_uid, callback) => pollAccount('/account/items/addresses', callback),
  saveUserAddress: async (_uid, label, address, deliveryDetails, location, addressId) => (await accountRequest<{ id: string }>('/account/items/addresses', 'POST', { label, address, deliveryDetails, location, addressId })).id,
  deleteSavedAddress: (_uid, id) => accountRequest(`/account/items/addresses/${encodeURIComponent(id)}`, 'DELETE'),
  createSupportTicket: () => Promise.reject(serviceAccessError()),
  listenToSupportTickets: (_uid, _callback, error) => { error?.(serviceAccessError()); return () => {}; },
  requestAccountDeletion: () => Promise.reject(deletionRequestServiceIdentityError()),
  createCodBooking: async (payload: { booking: any; expectedAmountCents: number; requestId: string }) => {
    const b = payload.booking;
    const items = (b.details?.items || []).map((it: any) => ({
      id: it.id,
      itemId: it.id,
      name: it.name || 'Item',
      price: it.price || 0,
      quantity: it.quantity || 1
    }));
    const res = await accountRequest<{ id: string; order_status: string }>('/orders/create', 'POST', {
      restaurantId: b.details?.restaurantId || '',
      restaurantName: b.pickupAddress || 'Restaurant',
      items,
      deliveryAddress: { address: b.dropAddress || '' },
      paymentMethod: 'cod'
    });
    return { bookingId: res.id, status: res.order_status || 'placed' };
  },
  requestBookingCancellation: async (bookingId: string, reason?: string) => {
    return accountRequest(`/orders/${encodeURIComponent(bookingId)}/cancel`, 'POST', { reason: reason || 'Customer requested cancellation' });
  },
  listenToCustomerBookings: (_uid, callback, error) => {
    return pollAccount('/orders/customer', (rawOrders: any[]) => {
      const mapped = (Array.isArray(rawOrders) ? rawOrders : []).map(row => {
        let status = 'pending';
        if (row.order_status === 'cancelled' || row.order_status === 'rejected') status = 'cancelled';
        else if (row.order_status === 'delivered' || row.delivery_status === 'delivered') status = 'delivered';
        else if (row.delivery_status === 'at_customer') status = 'arrived_at_destination';
        else if (row.delivery_status === 'picked_up') status = 'transit';
        else if (row.delivery_status === 'at_store') status = 'driver_at_store';
        else if (row.delivery_status === 'assigned') status = 'driver_assigned';
        else if (row.order_status === 'ready_for_pickup') status = 'ready';
        else if (row.order_status === 'preparing') status = 'preparing';
        else if (row.order_status === 'accepted') status = 'accepted';

        return {
          bookingId: row.id,
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name || 'Customer',
          serviceType: 'food',
          status,
          order_status: row.order_status,
          delivery_status: row.delivery_status,
          deliveryOtp: row.delivery_otp,
          otp: row.delivery_otp,
          pickupCode: row.pickup_code,
          pickupOtp: row.pickup_code,
          price: Number(row.total || 0),
          pickupAddress: row.restaurant_name,
          dropAddress: typeof row.delivery_address === 'string' ? row.delivery_address : row.delivery_address?.address || '',
          driverId: row.driver_id,
          driverName: row.driver_name,
          merchantId: row.restaurant_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at,
          details: {
            restaurantId: row.restaurant_id,
            restaurantName: row.restaurant_name,
            items: row.items,
            prepTimeMinutes: row.prep_time_minutes
          }
        };
      });
      callback(mapped);
    }, error);
  },
  listenToBookingContacts: (id, callback, error) => pollAccount(`/data/bookings/${encodeURIComponent(id)}/contacts`, callback, error),
  listenToWalletLedger: (_uid, callback, error) => pollAccount('/account/items/ledger', callback, error),
  listPaymentActivity: () => accountRequest('/account/items/payments'),
  listenToRestaurants: (callback, error) => pollAccount('/data/catalog/restaurants', callback, error),
  listenToMenuItems: (id, callback, error) => pollAccount(`/data/catalog/menu?parent=${encodeURIComponent(id)}`, callback, error),
  listenToGroceryStores: (callback, error) => pollAccount('/data/catalog/groceries', callback, error),
  listenToGroceryProducts: (id, callback, error) => pollAccount(`/data/catalog/products?parent=${encodeURIComponent(id)}`, callback, error),
  getOrCreateDriverProfile: async (driverId, lat, lng) => ({
    driverId,
    vehicleType: 'bike',
    vehicleNo: 'KA-01-AB-1234',
    licenseNo: 'DL-9876543210',
    status: 'verified',
    online: true,
    currentLat: lat || 12.9716,
    currentLng: lng || 77.5946,
    todayEarnings: 450,
    completedJobs: 3,
    availableEarningsCents: 45000,
    reservedEarningsCents: 0,
    codCashInHandCents: 0,
  }),
  listenToMerchantBookings: (_outlets, callback, error) => {
    return pollAccount('/orders/merchant', (rawOrders: any[]) => {
      const mapped = (Array.isArray(rawOrders) ? rawOrders : []).map(row => {
        let status = 'pending';
        if (row.order_status === 'cancelled' || row.order_status === 'rejected') status = 'cancelled';
        else if (row.order_status === 'delivered' || row.delivery_status === 'delivered') status = 'delivered';
        else if (row.delivery_status === 'at_customer') status = 'arrived_at_destination';
        else if (row.delivery_status === 'picked_up') status = 'transit';
        else if (row.delivery_status === 'at_store') status = 'driver_at_store';
        else if (row.delivery_status === 'assigned') status = 'driver_assigned';
        else if (row.order_status === 'ready_for_pickup') status = 'ready';
        else if (row.order_status === 'preparing') status = 'preparing';
        else if (row.order_status === 'accepted') status = 'accepted';

        return {
          bookingId: row.id,
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name || 'Customer',
          customerPhone: row.customer_phone,
          serviceType: 'food',
          status,
          order_status: row.order_status,
          delivery_status: row.delivery_status,
          deliveryOtp: row.delivery_otp,
          otp: row.delivery_otp,
          pickupCode: row.pickup_code,
          pickupOtp: row.pickup_code,
          price: Number(row.total || 0),
          pickupAddress: row.restaurant_name,
          dropAddress: typeof row.delivery_address === 'string' ? row.delivery_address : row.delivery_address?.address || '',
          driverId: row.driver_id,
          driverName: row.driver_name,
          merchantId: row.restaurant_id || 'res-1',
          createdAt: row.created_at,
          updatedAt: row.updated_at || row.created_at,
          arrivedAtPickup: row.delivery_status === 'at_store' || row.delivery_status === 'picked_up',
          merchantPickupConfirmedAt: row.picked_up_at,
          details: {
            restaurantId: row.restaurant_id,
            restaurantName: row.restaurant_name,
            items: row.items,
            prepTimeMinutes: row.prep_time_minutes
          }
        };
      });
      callback(mapped);
    }, error);
  },
  advanceMerchantBooking: async (bookingId: string, status: 'preparing' | 'ready', prepMinutes?: number) => {
    if (status === 'preparing') {
      return accountRequest(`/orders/${encodeURIComponent(bookingId)}/merchant-accept`, 'POST', { prepTimeMinutes: prepMinutes || 15 });
    }
    return accountRequest(`/orders/${encodeURIComponent(bookingId)}/merchant-ready`, 'POST');
  },
  confirmMerchantPickup: async (bookingId: string) => {
    return accountRequest(`/orders/${encodeURIComponent(bookingId)}/merchant-confirm-pickup`, 'POST');
  },
  listenToDriverBookings: (_uid, callback, error) => {
    return pollAccount('/orders/driver', (rawActiveOrder: any) => {
      void accountRequest<{ offer?: any }>('/driver/current-offer').then(offerRes => {
        const bookings: any[] = [];
        if (offerRes?.offer) {
          const off = offerRes.offer;
          const orderId = off.orderId || off.order_id || off.id;
          const offerId = off.id || off.offer_id || off.offerId;
          bookings.push({
            bookingId: orderId,
            id: orderId,
            serviceType: 'food',
            status: 'ready',
            price: Number(off.total || off.estimatedEarnings || 0),
            pickupAddress: off.restaurantName || off.restaurant_name,
            dropAddress: typeof off.dropAddress === 'string' ? off.dropAddress : typeof off.delivery_address === 'string' ? off.delivery_address : off.delivery_address?.address || '',
            createdAt: new Date().toISOString(),
            offerExpiresAt: off.expires_at || (off.secondsRemaining ? new Date(Date.now() + off.secondsRemaining * 1000).toISOString() : undefined),
            offerId,
            details: {
              items: off.items
            }
          });
        }
        if (rawActiveOrder) {
          let status = 'accepted';
          if (rawActiveOrder.delivery_status === 'at_customer') status = 'arrived_at_destination';
          else if (rawActiveOrder.delivery_status === 'picked_up') status = 'transit';
          else if (rawActiveOrder.delivery_status === 'at_store') status = 'driver_at_store';
          bookings.push({
            bookingId: rawActiveOrder.id,
            id: rawActiveOrder.id,
            customerId: rawActiveOrder.customer_id,
            customerName: rawActiveOrder.customer_name || 'Customer',
            customerPhone: rawActiveOrder.customer_phone,
            serviceType: 'food',
            status,
            order_status: rawActiveOrder.order_status,
            delivery_status: rawActiveOrder.delivery_status,
            pickupCode: rawActiveOrder.pickup_code,
            price: Number(rawActiveOrder.total || 0),
            pickupAddress: rawActiveOrder.restaurant_name,
            dropAddress: typeof rawActiveOrder.delivery_address === 'string' ? rawActiveOrder.delivery_address : rawActiveOrder.delivery_address?.address || '',
            driverId: rawActiveOrder.driver_id,
            driverName: rawActiveOrder.driver_name,
            createdAt: rawActiveOrder.created_at,
            updatedAt: rawActiveOrder.updated_at,
            arrivedAtPickup: rawActiveOrder.delivery_status === 'at_store' || rawActiveOrder.delivery_status === 'picked_up',
            merchantPickupConfirmedAt: rawActiveOrder.picked_up_at,
            details: {
              items: rawActiveOrder.items
            }
          });
        }
        callback(bookings);
      }).catch(() => {
        callback(rawActiveOrder ? [rawActiveOrder] : []);
      });
    }, error);
  },
  acceptDriverBooking: async (bookingId: string) => {
    const offerRes = await accountRequest<{ offer?: any }>('/driver/current-offer').catch(() => null);
    const offerId = offerRes?.offer?.id || offerRes?.offer?.offer_id || offerRes?.offer?.offerId;
    if (offerId) {
      return accountRequest(`/driver/offers/${encodeURIComponent(offerId)}/accept`, 'POST');
    }
    return accountRequest(`/orders/${encodeURIComponent(bookingId)}/driver-assign`, 'POST');
  },
  advanceDriverBooking: async (bookingId: string, status: 'preparing' | 'transit' | 'arrived_at_destination' | 'completed', otp?: string) => {
    if (status === 'preparing') {
      return accountRequest(`/orders/${encodeURIComponent(bookingId)}/driver-at-store`, 'POST');
    }
    if (status === 'transit') {
      return accountRequest(`/orders/${encodeURIComponent(bookingId)}/driver-verify-pickup`, 'POST', { pickupCode: otp });
    }
    if (status === 'arrived_at_destination') {
      return accountRequest(`/orders/${encodeURIComponent(bookingId)}/driver-at-customer`, 'POST');
    }
    if (status === 'completed') {
      return accountRequest(`/orders/${encodeURIComponent(bookingId)}/driver-verify-delivery`, 'POST', { deliveryOtp: otp });
    }
  },
  listenToDriverLocation: () => () => {},
  updateDriverLocation: async (lat: number, lng: number) => {
    return accountRequest('/driver/status', 'POST', { online: true, lat, lng });
  },
  listenToBookingTracking: (bookingId: string, callback: (v: any) => void) => {
    return pollAccount(`/orders/${encodeURIComponent(bookingId)}/tracking`, (data: any) => {
      if (data && data.lat !== null && data.lat !== undefined && data.lng !== null && data.lng !== undefined) {
        callback({
          driverId: data.driver_id,
          currentLat: Number(data.lat),
          currentLng: Number(data.lng),
          locationUpdatedAt: data.updated_at || new Date().toISOString()
        });
      } else {
        callback(null);
      }
    });
  },
  updateDriverStatus: async (_uid, updates) => {
    if (updates?.online !== undefined || updates?.currentLat !== undefined) {
      return accountRequest('/driver/status', 'POST', { online: updates.online, lat: updates.currentLat, lng: updates.currentLng });
    }
  },
  updateDriverVerification: async () => {},
  listenToDriverLedger: (_uid, cb) => { cb([]); return () => {}; },
  listenToUserNotifications: (_uid, cb) => { cb([]); return () => {}; },
  markUserNotificationsRead: async () => {},
  listenToChatMessages: (bookingId: string, callback: (msgs: any[]) => void) => {
    return pollAccount(`/orders/${encodeURIComponent(bookingId)}/chats`, (msgs: any[]) => {
      callback(Array.isArray(msgs) ? msgs : []);
    });
  },
  sendChatMessage: async (bookingId: string, _senderId: string, _senderName: string, text: string) => {
    return accountRequest(`/orders/${encodeURIComponent(bookingId)}/chats`, 'POST', { text });
  },
  createPayoutRequest: async () => {},
  requestTransportOperatorLink: async () => {},
  listDriverBookingHistory: async () => [],
  triggerDriverEmergencySos: async () => {},
};