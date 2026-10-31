'use strict';

const crypto = require('node:crypto');

function merchantCancellationFunctions({
  onCall,
  db,
  REGION,
  Timestamp,
  HttpsError,
  documentId,
  cleanText,
  FieldValue,
  issueRefund,
  restoreCancelledInventory,
  journal,
  addCents,
  requireUser,
  merchantHasPermission
}) {
  const merchantOwns = (account, record) => merchantHasPermission(
    account,
    record?.merchantId,
    record?.serviceType === 'food' ? 'restaurant' : record?.serviceType === 'grocery' ? 'grocery' : null,
    'orders'
  );

  const merchantCancelAfterAccept = onCall({ operation: 'merchantCancelAfterAccept', region: REGION }, async request => {
    const uid = requireUser(request);
    const bookingId = documentId(request.data?.bookingId, 'Booking reference');
    const reason = cleanText(request.data?.reason, 'Cancellation reason', 500);

    const bookingRef = db.doc(`bookings/${bookingId}`);
    let postRefundNeeded = null;

    const result = await db.runTransaction(async tx => {
      const [bookingSnap, accountSnap] = await Promise.all([
        tx.get(bookingRef),
        tx.get(db.doc(`users/${uid}`))
      ]);

      if (!bookingSnap.exists) throw new HttpsError('not-found', 'Order not found.');
      const booking = bookingSnap.data();
      const account = accountSnap.data();

      if (!merchantOwns(account, booking) && account?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'This order does not belong to your business or you lack order management permission.');
      }

      if (['cancelled', 'completed', 'delivered'].includes(booking.status)) {
        throw new HttpsError('failed-precondition', `Order is already ${booking.status}.`);
      }

      if (!['preparing', 'ready'].includes(booking.status)) {
        throw new HttpsError('failed-precondition', 'Only accepted orders in preparation or ready state can be cancelled through this action.');
      }

      if (booking.exception?.status === 'open') {
        throw new HttpsError('failed-precondition', 'Operations must resolve the reported booking problem first.');
      }

      const nowISO = new Date().toISOString();
      const driverRef = booking.driverId ? db.doc(`driver_profiles/${booking.driverId}`) : null;
      let cash = null, cashRef = null;
      let customerAccount = null, customerAccountRef = null;
      let attempt = null, attemptRef = null;
      let driver = null;

      if (booking.paymentStatus === 'pending_cod') {
        cashRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [cash, driver] = await Promise.all([tx.get(cashRef), driverRef ? tx.get(driverRef) : null]);
      } else if (booking.paymentOrderId?.startsWith('wallet_')) {
        customerAccountRef = db.doc(`users/${booking.customerId}`);
        attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [customerAccount, attempt, driver] = await Promise.all([
          tx.get(customerAccountRef),
          tx.get(attemptRef),
          driverRef ? tx.get(driverRef) : null
        ]);
      } else {
        if (booking.paymentOrderId) {
          attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
          [attempt, driver] = await Promise.all([
            tx.get(attemptRef),
            driverRef ? tx.get(driverRef) : null
          ]);
        }
      }

      if (restoreCancelledInventory) {
        await restoreCancelledInventory(tx, bookingRef, booking);
      }

      const amount = Math.round((booking.price || 0) * 100);

      // 1. COD refund/cancellation
      if (booking.paymentStatus === 'pending_cod') {
        if (cash && cash.exists) {
          tx.update(cashRef, { status: 'cancelled', updatedAt: Timestamp.now() });
        }
        tx.create(db.doc(`financial_journals/cod_cancelled_${bookingId}`), journal(
          'cod_booking_cancelled',
          'booking_funds_unallocated',
          'customer_receivable_cod',
          amount,
          { bookingId, orderId: booking.paymentOrderId, customerId: booking.customerId, reason }
        ));
      }
      // 2. Wallet refund
      else if (booking.paymentOrderId?.startsWith('wallet_') && customerAccount && customerAccount.exists) {
        const balance = Math.round((customerAccount.data().walletBalance || 0) * 100);
        const nextBalance = addCents(balance, amount);
        tx.update(customerAccountRef, { walletBalance: nextBalance / 100 });
        tx.create(db.doc(`wallet_ledger/${booking.customerId}/entries/refund_${bookingId}`), {
          kind: 'refund',
          amountCents: amount,
          balanceCents: nextBalance,
          bookingId,
          reason,
          createdAt: nowISO
        });
        tx.create(db.doc(`financial_journals/wallet_refund_${bookingId}`), journal(
          'wallet_booking_refund',
          'booking_funds_unallocated',
          'wallet_liability',
          amount,
          { bookingId, customerId: booking.customerId, orderId: booking.paymentOrderId, reason }
        ));
        if (attemptRef && attempt && attempt.exists) {
          tx.update(attemptRef, { status: 'refunded', updatedAt: Timestamp.now() });
        }
      }
      // 3. Online payment refund
      else if (booking.paymentId && ['paid', 'refund_processing'].includes(booking.paymentStatus)) {
        if (attemptRef && attempt && attempt.exists) {
          tx.update(attemptRef, {
            status: 'refund_processing',
            refundRequestedAmountCents: amount,
            updatedAt: Timestamp.now()
          });
        }
        postRefundNeeded = { paymentId: booking.paymentId, amount, attemptRef, bookingId };
      }

      // Update merchant scorecard and outlet
      if (booking.merchantId) {
        const outletCol = booking.serviceType === 'grocery' ? 'grocery_stores' : 'restaurants';
        tx.set(
          db.doc(`${outletCol}/${booking.merchantId}`),
          { cancelledAfterAccept: FieldValue.increment(1) },
          { merge: true }
        );
        tx.set(
          db.doc(`merchant_scorecards/${booking.merchantId}`),
          { cancelledAfterAccept: FieldValue.increment(1), updatedAt: Timestamp.now() },
          { merge: true }
        );
      }

      // Free driver if assigned
      if (driver?.data()?.activeBookingId === bookingId) {
        tx.update(driverRef, { activeBookingId: null });
      }

      // Delete pickup code
      tx.delete(db.doc(`booking_codes/${bookingId}`));

      // Record lifecycle event
      tx.create(bookingRef.collection('events').doc(`merchant_cancel_after_accept_${Date.now()}`), {
        stage: 'merchant_cancelled_after_accept',
        actorId: uid,
        actorRole: 'merchant',
        reason,
        createdAt: nowISO
      });

      const nextPaymentStatus = booking.paymentStatus === 'pending_cod'
        ? 'cancelled'
        : booking.paymentOrderId?.startsWith('wallet_')
        ? 'refunded'
        : 'refund_processing';

      tx.update(bookingRef, {
        status: 'cancelled',
        paymentStatus: nextPaymentStatus,
        cancellationReason: reason,
        cancelledBy: 'merchant',
        updatedAt: nowISO
      });

      return {
        status: 'cancelled',
        paymentStatus: nextPaymentStatus,
        bookingId
      };
    });

    if (postRefundNeeded && issueRefund) {
      try {
        const refund = await issueRefund(postRefundNeeded.paymentId, postRefundNeeded.amount);
        await db.runTransaction(async tx2 => {
          tx2.update(bookingRef, {
            paymentStatus: refund.status === 'failed' ? 'refund_required' : 'refunded',
            updatedAt: new Date().toISOString()
          });
          if (postRefundNeeded.attemptRef) {
            tx2.update(postRefundNeeded.attemptRef, {
              status: refund.status === 'failed' ? 'refund_required' : 'refunded',
              refundId: refund.id,
              refundStatus: refund.status,
              updatedAt: Timestamp.now()
            });
          }
        });
      } catch (err) {
        console.error('Post-cancellation refund processing error:', err.message);
        await bookingRef.update({
          paymentStatus: 'refund_required',
          updatedAt: new Date().toISOString()
        });
      }
    }

    return result;
  });

  const merchantRemoveOrderItem = onCall({ operation: 'merchantRemoveOrderItem', region: REGION }, async request => {
    const uid = requireUser(request);
    const bookingId = documentId(request.data?.bookingId, 'Booking reference');
    const itemIndex = Number(request.data?.itemIndex);
    const reason = cleanText(request.data?.reason || 'Item unavailable', 'Removal reason', 300);

    if (!Number.isInteger(itemIndex) || itemIndex < 0) {
      throw new HttpsError('invalid-argument', 'Valid item index is required.');
    }

    const bookingRef = db.doc(`bookings/${bookingId}`);
    let postRefundNeeded = null;

    const result = await db.runTransaction(async tx => {
      const [bookingSnap, accountSnap] = await Promise.all([
        tx.get(bookingRef),
        tx.get(db.doc(`users/${uid}`))
      ]);

      if (!bookingSnap.exists) throw new HttpsError('not-found', 'Order not found.');
      const booking = bookingSnap.data();
      const account = accountSnap.data();

      if (!merchantOwns(account, booking) && account?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'This order does not belong to your business or you lack order management permission.');
      }

      if (['cancelled', 'completed', 'delivered'].includes(booking.status)) {
        throw new HttpsError('failed-precondition', `Cannot remove items from an order that is already ${booking.status}.`);
      }

      if (!['preparing', 'ready'].includes(booking.status)) {
        throw new HttpsError('failed-precondition', 'Items can only be removed from accepted orders in preparation or ready state.');
      }

      const items = Array.isArray(booking.details?.items) ? [...booking.details.items] : [];
      if (itemIndex >= items.length) {
        throw new HttpsError('invalid-argument', 'Item index is out of range.');
      }

      const targetItem = items[itemIndex];
      if (targetItem.removed) {
        throw new HttpsError('failed-precondition', 'This item is already removed from the order.');
      }

      const unremovedBefore = items.filter(it => !it.removed);
      // If this is the last unremoved item, user must cancel order instead
      if (unremovedBefore.length <= 1) {
        throw new HttpsError('failed-precondition', 'Cannot remove the only remaining item. Cancel the order instead.');
      }

      const itemQty = targetItem.quantity || 1;
      const itemUnitPrice = Number(targetItem.price) || 0;
      const itemRefundAmount = Math.round(itemUnitPrice * itemQty * 100) / 100;
      const itemRefundCents = Math.round(itemRefundAmount * 100);

      const oldPrice = Number(booking.price) || 0;
      const newPrice = Math.max(0, Math.round((oldPrice - itemRefundAmount) * 100) / 100);
      const nowISO = new Date().toISOString();

      // Mark item removed
      items[itemIndex] = {
        ...targetItem,
        removed: true,
        removedReason: reason,
        removedAt: nowISO
      };

      // Handle partial refund
      let customerAccount = null, customerAccountRef = null;
      let cash = null, cashRef = null;
      let attempt = null, attemptRef = null;

      if (booking.paymentStatus === 'pending_cod') {
        cashRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        cash = await tx.get(cashRef);
        if (cash.exists) {
          const newCashAmount = Math.round(newPrice * 100);
          tx.update(cashRef, {
            amount: newCashAmount,
            updatedAt: Timestamp.now()
          });
        }
      } else if (booking.paymentOrderId?.startsWith('wallet_')) {
        customerAccountRef = db.doc(`users/${booking.customerId}`);
        attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [customerAccount, attempt] = await Promise.all([
          tx.get(customerAccountRef),
          tx.get(attemptRef)
        ]);
        if (customerAccount && customerAccount.exists) {
          const balance = Math.round((customerAccount.data().walletBalance || 0) * 100);
          const nextBalance = addCents(balance, itemRefundCents);
          tx.update(customerAccountRef, { walletBalance: nextBalance / 100 });
          tx.create(db.doc(`wallet_ledger/${booking.customerId}/entries/partial_refund_${bookingId}_${itemIndex}`), {
            kind: 'partial_refund',
            amountCents: itemRefundCents,
            balanceCents: nextBalance,
            bookingId,
            itemIndex,
            itemName: targetItem.name,
            reason,
            createdAt: nowISO
          });
          tx.create(db.doc(`financial_journals/wallet_partial_refund_${bookingId}_${itemIndex}`), journal(
            'wallet_item_partial_refund',
            'booking_funds_unallocated',
            'wallet_liability',
            itemRefundCents,
            { bookingId, customerId: booking.customerId, orderId: booking.paymentOrderId, itemIndex, reason }
          ));
        }
      } else if (booking.paymentId && ['paid', 'refund_processing'].includes(booking.paymentStatus)) {
        if (booking.paymentOrderId) {
          attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        }
        postRefundNeeded = {
          paymentId: booking.paymentId,
          amount: itemRefundCents,
          bookingId,
          itemIndex
        };
      }

      // Update merchant scorecard for item removal
      if (booking.merchantId) {
        tx.set(
          db.doc(`merchant_scorecards/${booking.merchantId}`),
          { itemRemovals: FieldValue.increment(1), updatedAt: Timestamp.now() },
          { merge: true }
        );
      }

      // Record item removal event
      tx.create(bookingRef.collection('events').doc(`merchant_item_removed_${Date.now()}`), {
        stage: 'merchant_item_removed',
        actorId: uid,
        actorRole: 'merchant',
        itemIndex,
        itemName: targetItem.name,
        refundAmount: itemRefundAmount,
        reason,
        createdAt: nowISO
      });

      // Update booking
      tx.update(bookingRef, {
        price: newPrice,
        'details.items': items,
        updatedAt: nowISO
      });

      return {
        success: true,
        bookingId,
        itemIndex,
        itemName: targetItem.name,
        refundAmount: itemRefundAmount,
        newPrice
      };
    });

    if (postRefundNeeded && issueRefund) {
      try {
        await issueRefund(postRefundNeeded.paymentId, postRefundNeeded.amount);
      } catch (err) {
        console.error('Post item removal refund error:', err.message);
      }
    }

    return result;
  });

  return {
    merchantCancelAfterAccept,
    merchantRemoveOrderItem
  };
}

module.exports = {
  merchantCancellationFunctions
};
