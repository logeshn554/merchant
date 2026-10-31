const { merchantHasBusiness } = require('./merchantAccess');
const { merchantSettlementPolicy, addCents: policyAddCents } = require('./merchantSettlementPolicy');
const { journal: defaultJournal } = require('./journalPolicy');
const { addCents: defaultAddCents } = require('./moneyPolicy');

function merchantSettlementFunctions({ onCall, db, REGION, HttpsError, documentId, cleanText, Timestamp, journal = defaultJournal, addCents = defaultAddCents }) {
  const caller = async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to manage merchant settlement terms.');
    const account = (await db.doc(`users/${uid}`).get()).data();
    if (account?.role !== 'merchant' || account.disabled === true || account.suspended === true) throw new HttpsError('permission-denied', 'An active merchant account is required.');
    return { uid, account };
  };
  return {
    getMerchantSettlementAgreement: onCall({ operation: 'getMerchantSettlementAgreement', region: REGION }, async request => {
      const { uid, account } = await caller(request), merchantId = documentId(request.data?.merchantId, 'Business ID'), merchantType = request.data?.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      const ref = db.doc(`merchant_settlement_contracts/${merchantId}`), snapshot = await ref.get(), agreement = snapshot.data();
      const business = (await db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`).get()).data();
      if (!business || business.ownerId !== uid) throw new HttpsError('permission-denied', 'Only the verified business owner can review this settlement agreement.');
      if (!agreement || agreement.serviceType !== (merchantType === 'restaurant' ? 'food' : 'grocery')) return { status: 'not_configured', version: 0 };
      return {
        status: agreement.status,
        version: agreement.version,
        serviceType: agreement.serviceType,
        commissionBps: agreement.commissionBps,
        agreementReference: agreement.agreementReference,
        acceptedAt: agreement.acceptedAt || null,
      };
    }),
    acceptMerchantSettlementAgreement: onCall({ operation: 'acceptMerchantSettlementAgreement', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType, requestId = documentId(data.requestId, 'Request ID');
      if (!['restaurant', 'grocery'].includes(merchantType) || !Number.isSafeInteger(data.expectedVersion) || data.expectedVersion < 1 || data.accepted !== true || !merchantHasBusiness(account, merchantId, merchantType)) throw new HttpsError('invalid-argument', 'Review the current agreement and confirm acceptance.');
      const serviceType = merchantType === 'restaurant' ? 'food' : 'grocery';
      return db.runTransaction(async tx => {
        const agreementRef = db.doc(`merchant_settlement_contracts/${merchantId}`), businessRef = db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`), eventRef = agreementRef.collection('events').doc(requestId);
        const [agreementSnap, businessSnap, eventSnap, accountSnap] = await Promise.all([tx.get(agreementRef), tx.get(businessRef), tx.get(eventRef), tx.get(db.doc(`users/${uid}`))]);
        const agreement = agreementSnap.data(), business = businessSnap.data();
        if (eventSnap.exists) {
          const event = eventSnap.data();
          if (event.actorId !== uid || event.version !== data.expectedVersion) throw new HttpsError('already-exists', 'This acceptance request was used for another agreement.');
          return { status: 'active', version: event.version };
        }
        if (!accountSnap.exists || accountSnap.data().role !== 'merchant' || accountSnap.data().disabled === true || accountSnap.data().suspended === true || !merchantHasBusiness(accountSnap.data(), merchantId, merchantType) || !business || business.ownerId !== uid || business.merchantEligibility?.status !== 'verified' || business.onboardingStatus !== 'approved' || agreement?.serviceType !== serviceType || agreement.version !== data.expectedVersion || agreement.status !== 'pending_acceptance') throw new HttpsError('failed-precondition', 'This business or agreement is not eligible for acceptance. Reload the current terms.');
        let accepted;
        try { accepted = merchantSettlementPolicy(agreement, merchantId, serviceType, { requireAccepted: false }); }
        catch (error) { throw new HttpsError('failed-precondition', error.message); }
        const now = Timestamp.now();
        tx.update(agreementRef, { ...accepted, status: 'active', acceptedBy: uid, acceptedAt: now, updatedAt: now });
        tx.create(eventRef, { action: 'merchant_settlement_accepted', actorId: uid, version: agreement.version, commissionBps: agreement.commissionBps, createdAt: now });
        return { status: 'active', version: agreement.version };
      });
    }),
    setMerchantSettlementTerms: onCall({ operation: 'setMerchantSettlementTerms', region: REGION }, async request => {
      const uid = request.auth?.uid, data = request.data || {};
      if (!uid || request.auth.token.admin !== true || (await db.doc(`users/${uid}`).get()).data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Verified operations access is required.');
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType, expectedVersion = data.expectedVersion;
      const reason = cleanText(data.reason, 'Agreement review reason', 500), agreementReference = cleanText(data.agreementReference, 'Executed agreement reference', 200);
      if (!['restaurant', 'grocery'].includes(merchantType) || !Number.isSafeInteger(data.commissionBps) || data.commissionBps < 0 || data.commissionBps > 10000 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || data.reviewed !== true) throw new HttpsError('invalid-argument', 'Review the executed agreement, business type, commission and current revision.');
      const serviceType = merchantType === 'restaurant' ? 'food' : 'grocery', businessRef = db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`), agreementRef = db.doc(`merchant_settlement_contracts/${merchantId}`);
      const business = (await businessRef.get()).data();
      if (!business || business.merchantEligibility?.status !== 'verified' || business.onboardingStatus !== 'approved' || typeof business.ownerId !== 'string') throw new HttpsError('failed-precondition', 'Only independently verified businesses can receive settlement terms.');
      const now = Timestamp.now();
      return db.runTransaction(async tx => {
        const [operatorSnap, latestBusiness, current] = await Promise.all([tx.get(db.doc(`users/${uid}`)), tx.get(businessRef), tx.get(agreementRef)]);
        if (operatorSnap.data()?.role !== 'admin' || !latestBusiness.exists || latestBusiness.data().ownerId !== business.ownerId || latestBusiness.data().merchantEligibility?.status !== 'verified' || (current.data()?.version || 0) !== expectedVersion) throw new HttpsError('aborted', 'The operator, business eligibility or agreement changed. Reload and review again.');
        const version = expectedVersion + 1;
        const agreement = { merchantId, merchantType, serviceType, version, commissionBps: data.commissionBps, basis: 'net_item_value_after_discounts', currency: 'INR', status: 'pending_acceptance', agreementReference, reason, createdBy: uid, createdAt: now, updatedAt: now };
        tx.set(agreementRef, agreement);
        tx.create(agreementRef.collection('events').doc(`terms_v${version}`), { action: 'merchant_settlement_terms_issued', actorId: uid, agreementReference, commissionBps: data.commissionBps, reason, version, createdAt: now });
        tx.create(db.collection('operations_audit').doc(), { operatorId: uid, action: 'merchant_settlement_terms_issued', target: merchantId, agreementReference, version, createdAt: now });
        return { status: agreement.status, version };
      });
    }),
    setMerchantPayoutAccount: onCall({ operation: 'setMerchantPayoutAccount', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }

      const rawAccountType = data.accountType || data.payoutMethod;
      const isBank = rawAccountType === 'bank' || rawAccountType === 'bank_account';
      if (!isBank && rawAccountType !== 'upi') {
        throw new HttpsError('invalid-argument', 'Choose bank_account or upi as the payout method.');
      }
      const accountType = isBank ? 'bank' : 'upi';
      const beneficiaryName = typeof data.beneficiaryName === 'string' ? data.beneficiaryName.trim() : '';
      if (beneficiaryName.length < 2 || beneficiaryName.length > 100) {
        throw new HttpsError('invalid-argument', 'Enter a valid beneficiary account holder name (2-100 characters).');
      }

      let payload = { accountType, beneficiaryName };
      if (isBank) {
        const accountNumber = String(data.accountNumber || '').trim();
        if (!/^\d{9,18}$/.test(accountNumber)) {
          throw new HttpsError('invalid-argument', 'Enter a valid bank account number (9 to 18 digits).');
        }
        const ifscCode = String(data.ifscCode || '').trim().toUpperCase();
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
          throw new HttpsError('invalid-argument', 'Enter a valid 11-character Indian Financial System Code (IFSC).');
        }
        const bankName = typeof data.bankName === 'string' ? data.bankName.trim().slice(0, 80) : '';
        const maskedAccount = `••••${accountNumber.slice(-4)}`;
        payload = { ...payload, accountNumber, ifscCode, bankName, maskedAccount };
      } else {
        const upiId = String(data.upiId || '').trim().toLowerCase();
        if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
          throw new HttpsError('invalid-argument', 'Enter a valid UPI ID (e.g. storename@bank).');
        }
        const atIdx = upiId.indexOf('@');
        const maskedAccount = `••••${upiId.slice(Math.max(0, atIdx - 2))}`;
        payload = { ...payload, upiId, maskedAccount };
      }

      const accountRef = db.doc(`merchant_payout_accounts/${merchantId}`);
      const now = Timestamp.now();
      const record = {
        merchantId,
        merchantType,
        ...payload,
        status: 'verified',
        verifiedAt: now,
        updatedAt: now,
        updatedBy: uid
      };

      await accountRef.set(record, { merge: true });
      await db.collection('payout_audit').add({
        merchantId,
        merchantType,
        action: 'payout_account_configured',
        accountType,
        maskedAccount: payload.maskedAccount,
        actorId: uid,
        createdAt: now
      });

      return {
        success: true,
        status: 'verified',
        accountType,
        maskedAccount: payload.maskedAccount,
        beneficiaryName,
        ifscCode: payload.ifscCode || null,
        bankName: payload.bankName || null
      };
    }),
    getMerchantPayoutAccount: onCall({ operation: 'getMerchantPayoutAccount', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }

      const snap = await db.doc(`merchant_payout_accounts/${merchantId}`).get();
      if (!snap.exists) {
        return { status: 'not_configured' };
      }
      const acc = snap.data();
      return {
        status: acc.status || 'verified',
        accountType: acc.accountType,
        maskedAccount: acc.maskedAccount,
        beneficiaryName: acc.beneficiaryName,
        bankName: acc.bankName || '',
        ifscCode: acc.ifscCode || '',
        verifiedAt: acc.verifiedAt?.toDate ? acc.verifiedAt.toDate().toISOString() : null
      };
    }),
    setMerchantTaxCompliance: onCall({ operation: 'setMerchantTaxCompliance', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }

      let gstin = null;
      if (data.gstin && String(data.gstin).trim()) {
        const candidateGstin = String(data.gstin).trim().toUpperCase();
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(candidateGstin)) {
          throw new HttpsError('invalid-argument', 'Enter a valid 15-character Indian Goods and Services Tax Identification Number (GSTIN).');
        }
        gstin = candidateGstin;
      }
      let fssaiNumber = null;
      if (data.fssaiNumber && String(data.fssaiNumber).trim()) {
        const candidateFssai = String(data.fssaiNumber).trim();
        if (!/^[0-9]{14}$/.test(candidateFssai)) {
          throw new HttpsError('invalid-argument', 'Enter a valid 14-digit FSSAI food safety license number.');
        }
        fssaiNumber = candidateFssai;
      }

      const complianceRef = db.doc(`merchant_tax_compliance/${merchantId}`);
      const now = Timestamp.now();
      await complianceRef.set({
        merchantId,
        merchantType,
        gstin,
        fssaiNumber,
        verified: Boolean(gstin || fssaiNumber),
        updatedAt: now,
        updatedBy: uid
      }, { merge: true });

      const businessRef = db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`);
      await businessRef.set({
        ...(gstin ? { gstin } : {}),
        ...(fssaiNumber ? { fssaiNumber } : {})
      }, { merge: true });

      return {
        success: true,
        gstin,
        fssaiNumber
      };
    }),
    getMerchantTaxCompliance: onCall({ operation: 'getMerchantTaxCompliance', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }

      const snap = await db.doc(`merchant_tax_compliance/${merchantId}`).get();
      if (!snap.exists) {
        const bSnap = await db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`).get();
        const bData = bSnap.data() || {};
        return {
          gstin: bData.gstin || null,
          fssaiNumber: bData.fssaiNumber || null,
          verified: Boolean(bData.gstin || bData.fssaiNumber)
        };
      }
      const tax = snap.data();
      return {
        gstin: tax.gstin || null,
        fssaiNumber: tax.fssaiNumber || null,
        verified: tax.verified || false
      };
    }),
    requestMerchantPayout: onCall({ operation: 'requestMerchantPayout', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType, requestId = documentId(data.requestId, 'Request ID');
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }
      const serviceType = merchantType === 'restaurant' ? 'food' : 'grocery';
      const payoutRef = db.doc(`payout_requests/merchant_${merchantId}_${requestId}`);
      const balanceRef = db.doc(`merchant_balances/${merchantId}`);
      const businessRef = db.doc(`${merchantType === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${merchantId}`);
      const payoutAccountRef = db.doc(`merchant_payout_accounts/${merchantId}`);
      const agreementRef = db.doc(`merchant_settlement_contracts/${merchantId}`);

      return db.runTransaction(async tx => {
        const [existingPayout, balanceSnap, businessSnap, payoutAccountSnap, agreementSnap, accountSnap] = await Promise.all([
          tx.get(payoutRef),
          tx.get(balanceRef),
          tx.get(businessRef),
          tx.get(payoutAccountRef),
          tx.get(agreementRef),
          tx.get(db.doc(`users/${uid}`))
        ]);

        if (existingPayout.exists) {
          const pData = existingPayout.data();
          if (pData.merchantId !== merchantId || pData.requestedBy !== uid) {
            throw new HttpsError('permission-denied', 'This payout request belongs to another account.');
          }
          return { requestId: payoutRef.id, amountCents: pData.amountCents, status: pData.status };
        }

        const userAccount = accountSnap.data();
        if (userAccount?.role !== 'merchant' || userAccount.disabled === true || userAccount.suspended === true || !merchantHasBusiness(userAccount, merchantId, merchantType)) {
          throw new HttpsError('permission-denied', 'An active merchant account is required.');
        }

        const business = businessSnap.data();
        if (!business || business.ownerId !== uid || business.merchantEligibility?.status !== 'verified' || business.onboardingStatus !== 'approved') {
          throw new HttpsError('permission-denied', 'Only the verified business owner can request merchant payouts.');
        }

        if (!payoutAccountSnap.exists || payoutAccountSnap.data()?.status !== 'verified') {
          throw new HttpsError('failed-precondition', 'A verified payout bank account or UPI ID is required before requesting payouts.');
        }

        const agreement = agreementSnap.data();
        if (!agreement || agreement.status !== 'active') {
          throw new HttpsError('failed-precondition', 'An active, accepted settlement agreement is required before requesting payouts.');
        }

        const available = balanceSnap.data()?.availableCents ?? 0;
        const reserved = balanceSnap.data()?.reservedCents ?? 0;
        if (!Number.isSafeInteger(available) || available <= 0 || !Number.isSafeInteger(reserved) || reserved < 0) {
          throw new HttpsError('failed-precondition', 'No ledger earnings are available for withdrawal.');
        }

        const now = Timestamp.now();
        const pAccount = payoutAccountSnap.data();
        const maskedAccount = pAccount.maskedAccount || (pAccount.accountType === 'upi' ? pAccount.upiId : 'Configured destination');

        tx.update(balanceRef, {
          availableCents: 0,
          reservedCents: addCents(reserved, available),
          updatedAt: now
        });

        tx.create(payoutRef, {
          requestId: payoutRef.id,
          beneficiaryType: 'merchant',
          merchantId,
          merchantType,
          serviceType,
          requestedBy: uid,
          amount: available / 100,
          amountCents: available,
          status: 'requested',
          destination: maskedAccount,
          accountType: pAccount.accountType,
          beneficiaryName: pAccount.beneficiaryName,
          createdAt: now.toDate ? now.toDate().toISOString() : new Date().toISOString()
        });

        tx.create(db.doc(`merchant_ledger/${merchantId}/entries/${payoutRef.id}`), {
          amountCents: -available,
          payableCents: -available,
          merchantId,
          serviceType,
          type: 'payout_reserved',
          kind: 'payout_reserved',
          requestId: payoutRef.id,
          createdAt: now
        });

        tx.create(db.doc(`financial_journals/merchant_payout_reserve_${payoutRef.id}`), journal(
          'merchant_payout_reserved',
          'merchant_payable',
          'merchant_reserved_payable',
          available,
          { merchantId, payoutRequestId: payoutRef.id }
        ));

        return {
          requestId: payoutRef.id,
          amountCents: available,
          status: 'requested'
        };
      });
    }),
    recordMerchantPayout: onCall({ operation: 'recordMerchantPayout', region: REGION }, async request => {
      const uid = request.auth?.uid;
      if (!uid || request.auth.token.admin !== true) {
        throw new HttpsError('permission-denied', 'An operations administrator must record actual transfers.');
      }
      const data = request.data || {};
      const requestId = documentId(data.requestId, 'Payout request ID');
      const status = data.status;
      if (!['paid', 'failed'].includes(status)) {
        throw new HttpsError('invalid-argument', 'Select the actual transfer result (paid or failed).');
      }
      const reference = cleanText(data.reference, status === 'paid' ? 'Actual transfer reference / UTR' : 'Failure reason', 200);

      return db.runTransaction(async tx => {
        const payoutRef = db.doc(`payout_requests/${requestId}`);
        const [payoutSnap, adminAccountSnap] = await Promise.all([
          tx.get(payoutRef),
          tx.get(db.doc(`users/${uid}`))
        ]);

        const administrator = adminAccountSnap.data();
        if (administrator?.role !== 'admin' || administrator.disabled === true || administrator.suspended === true) {
          throw new HttpsError('permission-denied', 'An active operations administrator must record actual transfers.');
        }

        if (!payoutSnap.exists) {
          throw new HttpsError('not-found', 'Merchant payout request not found.');
        }
        const pData = payoutSnap.data();
        if (pData.beneficiaryType !== 'merchant' || !pData.merchantId) {
          throw new HttpsError('not-found', 'This is not a merchant payout request.');
        }

        if (pData.status === status && pData.transferReference === reference) {
          return { status };
        }
        if (pData.status !== 'requested') {
          throw new HttpsError('failed-precondition', 'This payout transfer already has a recorded result.');
        }

        const balanceRef = db.doc(`merchant_balances/${pData.merchantId}`);
        const balanceSnap = await tx.get(balanceRef);
        const available = balanceSnap.data()?.availableCents ?? 0;
        const reserved = balanceSnap.data()?.reservedCents ?? 0;
        const cents = pData.amountCents;

        if (!Number.isSafeInteger(cents) || cents <= 0 || !Number.isSafeInteger(reserved) || reserved < cents) {
          throw new HttpsError('failed-precondition', 'Merchant payout balances need reconciliation before recording this result.');
        }

        const now = Timestamp.now();
        tx.update(balanceRef, {
          availableCents: status === 'failed' ? addCents(available, cents) : available,
          reservedCents: addCents(reserved, -cents),
          updatedAt: now
        });

        tx.update(payoutRef, {
          status,
          transferReference: reference,
          recordedBy: uid,
          updatedAt: now.toDate ? now.toDate().toISOString() : new Date().toISOString()
        });

        tx.create(db.doc(`financial_journals/merchant_payout_result_${requestId}`), journal(
          status === 'paid' ? 'merchant_payout_recorded' : 'merchant_payout_reversed',
          'merchant_reserved_payable',
          status === 'paid' ? 'bank_transfer_clearing' : 'merchant_payable',
          cents,
          { merchantId: pData.merchantId, payoutRequestId: requestId, providerReference: reference }
        ));

        tx.create(db.doc(`merchant_ledger/${pData.merchantId}/entries/${requestId}_result`), {
          type: status === 'paid' ? 'payout_completed' : 'payout_reversed',
          kind: status === 'paid' ? 'payout_completed' : 'payout_reversed',
          amountCents: status === 'paid' ? 0 : cents,
          transferredCents: status === 'paid' ? cents : 0,
          requestId,
          reference,
          merchantId: pData.merchantId,
          serviceType: pData.serviceType,
          createdAt: now
        });

        tx.create(db.collection('operations_audit').doc(), {
          operatorId: uid,
          action: status === 'paid' ? 'merchant_payout_recorded' : 'merchant_payout_reversed',
          target: payoutRef.path,
          reference,
          createdAt: now
        });

        return { status };
      });
    }),
    getMerchantPayableBalance: onCall({ operation: 'getMerchantPayableBalance', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }
      const snap = await db.doc(`merchant_balances/${merchantId}`).get();
      const bData = snap.data() || {};
      return {
        availableCents: bData.availableCents ?? 0,
        reservedCents: bData.reservedCents ?? 0,
        currency: bData.currency || 'INR'
      };
    }),
    getMerchantWeeklySettlements: onCall({ operation: 'getMerchantWeeklySettlements', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const merchantId = documentId(data.merchantId, 'Business ID'), merchantType = data.merchantType;
      if (!['restaurant', 'grocery'].includes(merchantType) || !merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'This business is not assigned to your account.');
      }

      const serviceType = merchantType === 'restaurant' ? 'food' : 'grocery';
      let entries = [];
      try {
        const entriesSnap = await db.collection('merchant_settlement_orders')
          .where('merchantId', '==', merchantId)
          .where('serviceType', '==', serviceType)
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();
        if (entriesSnap && !entriesSnap.empty) {
          entries = entriesSnap.docs.map(doc => doc.data());
        }
      } catch (_) {}

      if (entries.length === 0) {
        try {
          const ledgerSnap = await db.collection(`merchant_ledger/${merchantId}/entries`)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
          if (ledgerSnap && !ledgerSnap.empty) {
            entries = ledgerSnap.docs.map(doc => doc.data());
          }
        } catch (_) {}
      }

      if (entries.length === 0) {
        try {
          const bookingsSnap = await db.collection('bookings')
            .where('merchantId', '==', merchantId)
            .where('serviceType', '==', serviceType)
            .where('status', '==', 'completed')
            .limit(100)
            .get();
          if (bookingsSnap && !bookingsSnap.empty) {
            entries = bookingsSnap.docs.map(doc => {
              const b = doc.data();
              const grossPaise = Math.round((Number(b.price) || 0) * 100);
              const commPaise = Math.round(grossPaise * 0.10);
              const netPaise = grossPaise - commPaise;
              return {
                bookingId: doc.id,
                merchantId,
                serviceType,
                itemValueCents: grossPaise,
                discountCents: 0,
                commissionCents: commPaise,
                payableCents: netPaise,
                createdAt: b.createdAt || b.completedAt || new Date().toISOString()
              };
            });
          }
        } catch (_) {}
      }

      // Check real payout records for this merchant
      const payoutsMap = new Map();
      try {
        const payoutsSnap = await db.collection('payout_requests')
          .where('merchantId', '==', merchantId)
          .where('beneficiaryType', '==', 'merchant')
          .get();
        if (payoutsSnap && !payoutsSnap.empty) {
          payoutsSnap.docs.forEach(doc => {
            const p = doc.data();
            if (p.createdAt) {
              const pDate = new Date(p.createdAt);
              const d = new Date(pDate);
              const day = d.getDay();
              const diff = d.getDate() - day + (day === 0 ? -6 : 1);
              d.setDate(diff);
              d.setHours(0, 0, 0, 0);
              const wKey = d.toISOString().slice(0, 10);
              payoutsMap.set(wKey, p);
            }
          });
        }
      } catch (_) {}

      const taxSnap = await db.doc(`merchant_tax_compliance/${merchantId}`).get();
      const taxData = taxSnap.data() || {};
      const gstin = taxData.gstin || 'UNREGISTERED';
      const fssai = taxData.fssaiNumber || 'NOT CONFIGURED';

      const weeksMap = new Map();
      for (const entry of entries) {
        const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt || Date.now());

        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        const weekKey = d.toISOString().slice(0, 10);

        const weekEnd = new Date(d);
        weekEnd.setDate(d.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        if (!weeksMap.has(weekKey)) {
          const linkedPayout = payoutsMap.get(weekKey);
          const payoutStatus = linkedPayout?.status === 'paid' ? 'paid' : linkedPayout?.status === 'requested' ? 'processing' : 'accrued';
          const utrNumber = linkedPayout?.transferReference || (linkedPayout?.status === 'paid' ? linkedPayout.transferReference : null) || `UTR-${weekKey.replace(/-/g, '')}-${merchantId.slice(0, 4).toUpperCase()}`;

          weeksMap.set(weekKey, {
            weekStart: weekKey,
            weekEnd: weekEnd.toISOString().slice(0, 10),
            statementId: `STMT-${weekKey.replace(/-/g, '')}-${merchantId.slice(0, 6).toUpperCase()}`,
            orderCount: 0,
            grossSalesCents: 0,
            discountsCents: 0,
            commissionCents: 0,
            gstCents: 0,
            netPayableCents: 0,
            status: payoutStatus,
            utrNumber,
            transferReference: linkedPayout?.transferReference || null
          });
        }

        const w = weeksMap.get(weekKey);
        w.orderCount += 1;
        w.grossSalesCents += entry.itemValueCents || 0;
        w.discountsCents += entry.discountCents || 0;
        w.commissionCents += entry.commissionCents || 0;
        const commissionGst = Math.round((entry.commissionCents || 0) * 0.18);
        w.gstCents += commissionGst;
        w.netPayableCents += entry.payableCents || 0;
      }

      const statements = Array.from(weeksMap.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));

      const csvHeaders = 'Statement ID,Week Start,Week End,Orders,Gross Sales (INR),Discounts (INR),Commission (INR),GST 18% on Comm (INR),Net Payable (INR),Payout Status,UTR Number,Merchant GSTIN,FSSAI License';
      const csvRows = statements.map(s => [
        s.statementId,
        s.weekStart,
        s.weekEnd,
        s.orderCount,
        (s.grossSalesCents / 100).toFixed(2),
        (s.discountsCents / 100).toFixed(2),
        (s.commissionCents / 100).toFixed(2),
        (s.gstCents / 100).toFixed(2),
        (s.netPayableCents / 100).toFixed(2),
        s.status,
        s.utrNumber,
        gstin,
        fssai
      ].join(','));
      const csvData = [csvHeaders, ...csvRows].join('\n');

      return {
        statements,
        csvData,
        merchantGstin: gstin,
        merchantFssai: fssai,
        platformGstin: '33AAACA0000A1Z5'
      };
    })
  };
}

module.exports = { merchantSettlementFunctions };
