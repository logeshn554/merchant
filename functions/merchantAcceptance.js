'use strict';

const {
  getMerchantAcceptanceDeadlineMinutes,
  validateMerchantAcceptanceInput,
  isOrderExpiredUnaccepted
} = require('./merchantAcceptancePolicy');

function merchantAcceptanceFunctions({
  onSchedule,
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
  journal
}) {
  const staff = async request => {
    if (!request.auth?.uid || request.auth.token?.admin !== true) {
      const userDoc = await db.doc(`users/${request.auth?.uid}`).get();
      if (userDoc.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Active operations authorization is required.');
      }
    }
  };

  async function cancelExpiredMerchantOrder(bookingId, { nowMs = Date.now() } = {}) {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    let postRefundNeeded = null;

    const result = await db.runTransaction(async tx => {
      const [bookingSnap, policySnap] = await Promise.all([
        tx.get(bookingRef),
        tx.get(db.doc('platform_config/merchant_acceptance'))
      ]);

      if (!bookingSnap.exists) return { skipped: 'not_found' };
      const booking = bookingSnap.data();

      // Replay-safety: already cancelled or refunded
      if (booking.status === 'cancelled' || ['cancelled', 'refunded'].includes(booking.paymentStatus)) {
        return { alreadyCancelled: true, bookingId, status: booking.status, paymentStatus: booking.paymentStatus };
      }

      // Accepted, preparing, ready, completed orders untouched
      if (booking.status !== 'pending') {
        return { skipped: 'not_pending', status: booking.status };
      }

      // Orders with open exception untouched
      if (booking.exception?.status === 'open') {
        return { skipped: 'open_exception', exception: booking.exception };
      }

      // Check if expired past policy deadline
      const policy = policySnap.data();
      if (!isOrderExpiredUnaccepted(booking, policy, nowMs)) {
        return { skipped: 'not_expired' };
      }

      // Phase 1: All Reads (must precede any transaction writes)
      const driverRef = booking.driverId ? db.doc(`driver_profiles/${booking.driverId}`) : null;
      let cash = null, cashRef = null;
      let account = null, accountRef = null;
      let attempt = null, attemptRef = null;
      let driver = null;

      if (booking.paymentStatus === 'pending_cod') {
        cashRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [cash, driver] = await Promise.all([tx.get(cashRef), driverRef ? tx.get(driverRef) : null]);
      } else if (booking.paymentOrderId?.startsWith('wallet_')) {
        accountRef = db.doc(`users/${booking.customerId}`);
        attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [account, attempt, driver] = await Promise.all([
          tx.get(accountRef),
          tx.get(attemptRef),
          driverRef ? tx.get(driverRef) : null
        ]);
      } else {
        attemptRef = db.doc(`payment_attempts/${booking.paymentOrderId}`);
        [attempt, driver] = await Promise.all([
          tx.get(attemptRef),
          driverRef ? tx.get(driverRef) : null
        ]);
      }

      // If grocery inventory needs to be restored, restoreCancelledInventory performs reads then updates
      if (restoreCancelledInventory) {
        await restoreCancelledInventory(tx, bookingRef, booking);
      }

      // Phase 2: All Writes
      const nowISO = new Date().toISOString();
      const amount = Math.round((booking.price || 0) * 100);

      // Increment merchant "missed order" counter
      if (booking.merchantId) {
        const outletCol = booking.serviceType === 'grocery' ? 'grocery_stores' : 'restaurants';
        tx.set(
          db.doc(`${outletCol}/${booking.merchantId}`),
          { missedOrders: FieldValue.increment(1) },
          { merge: true }
        );
        tx.set(
          db.doc(`merchant_scorecards/${booking.merchantId}`),
          { missedOrders: FieldValue.increment(1), updatedAt: Timestamp.now() },
          { merge: true }
        );
      }

      if (driver?.data()?.activeBookingId === bookingId) {
        tx.update(driverRef, { activeBookingId: null });
      }
      tx.delete(db.doc(`booking_codes/${bookingId}`));
      tx.create(bookingRef.collection('events').doc('merchant_acceptance_timeout'), {
        stage: 'merchant_acceptance_timeout',
        actorRole: 'system',
        reason: 'Auto-cancelled due to merchant acceptance deadline expiry',
        createdAt: nowISO
      });

      if (booking.paymentStatus === 'pending_cod') {
        if (cash && cash.exists) {
          tx.update(cashRef, { status: 'cancelled', updatedAt: Timestamp.now() });
        }
        if (journal) {
          tx.create(
            db.doc(`financial_journals/cod_cancelled_${bookingId}`),
            journal('cod_booking_cancelled', 'booking_funds_unallocated', 'customer_receivable_cod', amount, {
              bookingId,
              orderId: booking.paymentOrderId,
              customerId: booking.customerId
            })
          );
        }
        tx.update(bookingRef, {
          status: 'cancelled',
          paymentStatus: 'cancelled',
          cancellationReason: 'merchant_acceptance_timeout',
          updatedAt: nowISO
        });
        return { cancelled: true, bookingId, paymentStatus: 'cancelled' };
      }

      if (booking.paymentOrderId?.startsWith('wallet_')) {
        const currentBalance = Math.round((account?.data()?.walletBalance || 0) * 100);
        const nextBalance = currentBalance + amount;

        if (accountRef) {
          tx.update(accountRef, { walletBalance: nextBalance / 100 });
        }
        tx.create(db.doc(`wallet_ledger/${booking.customerId}/entries/refund_${bookingId}`), {
          kind: 'refund',
          amountCents: amount,
          balanceCents: nextBalance,
          bookingId,
          createdAt: nowISO
        });
        if (journal) {
          tx.create(
            db.doc(`financial_journals/wallet_refund_${bookingId}`),
            journal('wallet_booking_refund', 'booking_funds_unallocated', 'wallet_liability', amount, {
              bookingId,
              customerId: booking.customerId,
              orderId: booking.paymentOrderId
            })
          );
        }
        if (attempt && attempt.exists) {
          tx.update(attemptRef, { status: 'refunded', updatedAt: Timestamp.now() });
        }
        tx.update(bookingRef, {
          status: 'cancelled',
          paymentStatus: 'refunded',
          cancellationReason: 'merchant_acceptance_timeout',
          updatedAt: nowISO
        });
        return { cancelled: true, bookingId, paymentStatus: 'refunded' };
      }

      // Online card / Razorpay payment
      if (attempt && attempt.exists) {
        tx.update(attemptRef, {
          status: 'refund_processing',
          refundRequestedAmountCents: amount,
          updatedAt: Timestamp.now()
        });
      }
      tx.update(bookingRef, {
        status: 'cancelled',
        paymentStatus: 'refund_processing',
        cancellationReason: 'merchant_acceptance_timeout',
        updatedAt: nowISO
      });

      postRefundNeeded = { paymentId: booking.paymentId, amount, attemptRef };
      return { cancelled: true, bookingId, paymentStatus: 'refund_processing', refundStarted: true };
    });

    if (postRefundNeeded && issueRefund) {
      try {
        const refund = await issueRefund(postRefundNeeded.paymentId, postRefundNeeded.amount);
        if (refund && refund.status !== 'failed') {
          await db.runTransaction(async tx => {
            tx.update(bookingRef, { paymentStatus: 'refunded', updatedAt: new Date().toISOString() });
            tx.update(postRefundNeeded.attemptRef, { status: 'refunded', updatedAt: Timestamp.now() });
          });
          result.paymentStatus = 'refunded';
        }
      } catch (err) {
        console.error('Provider refund call failed for expired booking', { bookingId, error: err?.message });
      }
    }

    return result;
  }

  async function processExpiredMerchantOrders({ nowMs = Date.now(), limit = 50 } = {}) {
    const policySnap = await db.doc('platform_config/merchant_acceptance').get();
    const policy = policySnap.data();

    const pendingOrdersSnap = await db
      .collection('bookings')
      .where('status', '==', 'pending')
      .limit(limit)
      .get();

    const results = [];
    for (const doc of pendingOrdersSnap.docs) {
      const data = doc.data();
      if (isOrderExpiredUnaccepted(data, policy, nowMs)) {
        try {
          const res = await cancelExpiredMerchantOrder(doc.id, { nowMs });
          results.push(res);
        } catch (err) {
          console.error('Error auto-cancelling expired order', { bookingId: doc.id, error: err?.message });
        }
      }
    }
    return { processed: results.length, results };
  }

  return {
    cancelExpiredMerchantOrder,
    processExpiredMerchantOrders,

    getMerchantAcceptancePolicy: onCall(
      { operation: 'getMerchantAcceptancePolicy', region: REGION },
      async request => {
        await staff(request);
        const policy = (await db.doc('platform_config/merchant_acceptance').get()).data();
        return { version: policy?.version || 0, services: policy?.services || {} };
      }
    ),

    setMerchantAcceptancePolicy: onCall(
      { operation: 'setMerchantAcceptancePolicy', region: REGION },
      async request => {
        await staff(request);
        const validated = validateMerchantAcceptanceInput(request.data || {});
        const { service, deadlineMinutes, expectedVersion, reason, requestId } = validated;

        return db.runTransaction(async tx => {
          const ref = db.doc('platform_config/merchant_acceptance');
          const audit = ref.collection('history').doc(requestId);
          const [policySnap, eventSnap] = await Promise.all([tx.get(ref), tx.get(audit)]);

          if (eventSnap.exists) {
            const prior = eventSnap.data();
            if (
              prior.actorId !== request.auth.uid ||
              prior.service !== service ||
              prior.deadlineMinutes !== deadlineMinutes ||
              prior.reason !== reason ||
              prior.expectedVersion !== expectedVersion
            ) {
              throw new HttpsError('already-exists', 'This request reference was already used.');
            }
            return { version: prior.version };
          }

          const currentVersion = policySnap.data()?.version || 0;
          if (currentVersion !== expectedVersion) {
            throw new HttpsError('aborted', 'The merchant acceptance policy changed. Refresh before saving.');
          }

          const services = { ...(policySnap.data()?.services || {}) };
          const version = expectedVersion + 1;
          if (deadlineMinutes === null) {
            delete services[service];
          } else {
            services[service] = { deadlineMinutes };
          }

          tx.set(ref, { services, version, updatedAt: Timestamp.now() });
          tx.create(audit, {
            actorId: request.auth.uid,
            service,
            deadlineMinutes,
            reason,
            expectedVersion,
            version,
            previous: policySnap.data()?.services?.[service] || null,
            createdAt: Timestamp.now()
          });

          return { version };
        });
      }
    ),

    autoCancelExpiredMerchantOrders: onSchedule(
      { schedule: 'every 1 minutes', region: REGION, maxInstances: 1, timeoutSeconds: 540 },
      async () => {
        await processExpiredMerchantOrders();
      }
    ),

    processMerchantAcceptanceExpirations: onCall(
      { operation: 'processMerchantAcceptanceExpirations', region: REGION },
      async request => {
        await staff(request);
        return processExpiredMerchantOrders();
      }
    )
  };
}

module.exports = {
  merchantAcceptanceFunctions
};
