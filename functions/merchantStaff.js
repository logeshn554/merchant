const { STAFF_PERMISSIONS, merchantStaffGrant, merchantHasBusiness } = require('./merchantAccess');
const crypto = require('node:crypto');

const TYPES = ['restaurant', 'grocery'];
const ID = /^[A-Za-z0-9_-]{1,128}$/;

function merchantStaffFunctions({ onCall, db, REGION, HttpsError, documentId, Timestamp }) {
  const caller = async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to manage business staff.');
    const account = (await db.doc(`users/${uid}`).get()).data();
    if (account?.role !== 'merchant' || account.disabled === true || account.suspended === true) throw new HttpsError('permission-denied', 'An active merchant account is required.');
    return { uid, account };
  };
  const businessRef = (id, type) => db.doc(`${type === 'restaurant' ? 'restaurants' : 'grocery_stores'}/${id}`);
  const verifyOwner = async (uid, id, type) => {
    const [snapshot, profile] = await Promise.all([businessRef(id, type).get(), db.doc(`users/${uid}`).get()]);
    if (!snapshot.exists || snapshot.data().ownerId !== uid || profile.data()?.role !== 'merchant' || profile.data()?.disabled === true || profile.data()?.suspended === true) throw new HttpsError('permission-denied', 'Only the active verified business owner can manage staff.');
    return snapshot;
  };
  const parseBusiness = data => {
    const merchantId = documentId(data?.merchantId, 'Business ID'), merchantType = data?.merchantType;
    if (!ID.test(merchantId) || !TYPES.includes(merchantType)) throw new HttpsError('invalid-argument', 'Choose a valid business type and ID.');
    return { merchantId, merchantType };
  };

  const recordActivity = async (merchantId, merchantType, actorId, actorName, action, details = {}) => {
    try {
      await db.collection(`merchant_staff_activity/${merchantId}/events`).add({
        action,
        actorId,
        actorName: actorName || 'Merchant Staff',
        merchantId,
        merchantType,
        details,
        createdAt: Timestamp.now()
      });
    } catch (e) {
      console.warn('Failed to record staff activity', e.message);
    }
  };

  return {
    listMerchantStaff: onCall({ operation: 'listMerchantStaff', region: REGION }, async request => {
      const { uid } = await caller(request), { merchantId, merchantType } = parseBusiness(request.data);
      await verifyOwner(uid, merchantId, merchantType);
      const snapshot = await db.collection(`merchant_staff/${merchantId}/members`).limit(100).get();
      const members = await Promise.all(snapshot.docs.map(async member => {
        const account = (await db.doc(`users/${member.id}`).get()).data();
        if (!account || account.role !== 'merchant' || account.disabled === true || account.suspended === true) return null;
        return {
          uid: member.id,
          name: account.name || '',
          email: account.email || '',
          permissions: member.data().permissions || []
        };
      }));
      return { members: members.filter(Boolean) };
    }),

    grantMerchantStaffAccess: onCall({ operation: 'grantMerchantStaffAccess', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {}, { merchantId, merchantType } = parseBusiness(data);
      const staffUid = documentId(data.staffUid, 'Staff account ID');
      if (staffUid === uid || !Array.isArray(data.permissions) || data.permissions.length < 1 || data.permissions.length > STAFF_PERMISSIONS.length || new Set(data.permissions).size !== data.permissions.length || data.permissions.some(permission => !STAFF_PERMISSIONS.includes(permission))) throw new HttpsError('invalid-argument', 'Choose another existing merchant account and at least one valid permission.');
      await verifyOwner(uid, merchantId, merchantType);
      const memberRef = db.doc(`merchant_staff/${merchantId}/members/${staffUid}`), counterRef = db.doc(`merchant_staff/${merchantId}`), targetRef = db.doc(`users/${staffUid}`), ownerRef = db.doc(`users/${uid}`), businessDoc = businessRef(merchantId, merchantType);
      await db.runTransaction(async tx => {
        const [target, member, counter, owner, business] = await Promise.all([tx.get(targetRef), tx.get(memberRef), tx.get(counterRef), tx.get(ownerRef), tx.get(businessDoc)]), profile = target.data();
        if (owner.data()?.role !== 'merchant' || owner.data()?.disabled === true || owner.data()?.suspended === true || !business.exists || business.data().ownerId !== uid) throw new HttpsError('permission-denied', 'Only the active verified business owner can manage staff.');
        if (!target.exists || profile?.role !== 'merchant' || profile.disabled === true || profile.suspended === true || profile.accountAuthority === 'neon') throw new HttpsError('failed-precondition', 'Staff must have an active AllGo merchant account.');
        if (profile.merchantStaffAccess && (typeof profile.merchantStaffAccess !== 'object' || Array.isArray(profile.merchantStaffAccess) || Object.entries(profile.merchantStaffAccess).some(([id, grant]) => !ID.test(id) || !merchantStaffGrant({ merchantStaffAccess: { [id]: grant } }, id, grant?.merchantType)))) throw new HttpsError('failed-precondition', 'This staff account has malformed business access that needs operations review.');
        const current = { ...(profile.merchantStaffAccess || {}) };
        const existing = current[merchantId];
        if (existing && existing.ownerUid !== uid) throw new HttpsError('failed-precondition', 'This account already has access to the business under a different owner.');
        if (!existing && Object.keys(current).length >= 25) throw new HttpsError('resource-exhausted', 'This staff account has reached its business access limit.');
        const memberCount = counter.data()?.memberCount || 0;
        if (!member.exists && (!Number.isSafeInteger(memberCount) || memberCount < 0 || memberCount >= 100)) throw new HttpsError('resource-exhausted', 'This business has reached its 100-account staff limit.');
        current[merchantId] = { merchantType, ownerUid: uid, permissions: [...data.permissions].sort(), role: data.role || 'staff' };
        tx.set(memberRef, { staffUid, merchantType, permissions: [...data.permissions].sort(), role: data.role || 'staff', grantedBy: uid, updatedAt: Timestamp.now(), createdAt: member.data()?.createdAt || Timestamp.now() });
        tx.update(targetRef, { merchantStaffAccess: current });
        if (!member.exists) tx.set(counterRef, { memberCount: memberCount + 1 });
        tx.create(db.collection('operations_audit').doc(), { operatorId: uid, action: 'merchant_staff_access_granted', target: `${merchantType}:${merchantId}:${staffUid}`, permissions: [...data.permissions].sort(), createdAt: Timestamp.now() });
      });
      await recordActivity(merchantId, merchantType, uid, account?.name || 'Owner', 'staff_access_granted', { staffUid, permissions: data.permissions, role: data.role || 'staff' });
      return { granted: true };
    }),

    revokeMerchantStaffAccess: onCall({ operation: 'revokeMerchantStaffAccess', region: REGION }, async request => {
      const { uid, account } = await caller(request), { merchantId, merchantType } = parseBusiness(request.data), staffUid = documentId(request.data?.staffUid, 'Staff account ID');
      if (staffUid === uid) throw new HttpsError('invalid-argument', 'Owners cannot revoke their own business access.');
      await verifyOwner(uid, merchantId, merchantType);
      const memberRef = db.doc(`merchant_staff/${merchantId}/members/${staffUid}`), counterRef = db.doc(`merchant_staff/${merchantId}`), targetRef = db.doc(`users/${staffUid}`), ownerRef = db.doc(`users/${uid}`), businessDoc = businessRef(merchantId, merchantType);
      await db.runTransaction(async tx => {
        const [member, target, counter, owner, business] = await Promise.all([tx.get(memberRef), tx.get(targetRef), tx.get(counterRef), tx.get(ownerRef), tx.get(businessDoc)]);
        if (owner.data()?.role !== 'merchant' || owner.data()?.disabled === true || owner.data()?.suspended === true || !business.exists || business.data().ownerId !== uid) throw new HttpsError('permission-denied', 'Only the active verified business owner can manage staff.');
        if (!member.exists) return;
        const profile = target.data(), grant = profile?.merchantStaffAccess?.[merchantId];
        if (grant?.ownerUid === uid) {
          const access = { ...profile.merchantStaffAccess };
          delete access[merchantId];
          if (Object.keys(access).length) tx.update(targetRef, { merchantStaffAccess: access });
          else tx.update(targetRef, { merchantStaffAccess: require('firebase-admin/firestore').FieldValue.delete() });
        }
        tx.delete(memberRef);
        if (member.exists) tx.set(counterRef, { memberCount: Math.max(0, (Number.isSafeInteger(counter.data()?.memberCount) ? counter.data().memberCount : 1) - 1) });
        tx.create(db.collection('operations_audit').doc(), { operatorId: uid, action: 'merchant_staff_access_revoked', target: `${merchantType}:${merchantId}:${staffUid}`, createdAt: Timestamp.now() });
      });
      await recordActivity(merchantId, merchantType, uid, account?.name || 'Owner', 'staff_access_revoked', { staffUid });
      return { revoked: true };
    }),

    createMerchantStaffInvite: onCall({ operation: 'createMerchantStaffInvite', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {}, { merchantId, merchantType } = parseBusiness(data);
      await verifyOwner(uid, merchantId, merchantType);

      const contactType = ['phone', 'email', 'code'].includes(data.contactType) ? data.contactType : 'code';
      let targetContact = null;
      if (contactType === 'phone') {
        const phone = String(data.targetContact || '').trim();
        if (!/^\+?[0-9]{10,15}$/.test(phone)) {
          throw new HttpsError('invalid-argument', 'Enter a valid 10-15 digit phone number with optional country code.');
        }
        targetContact = phone;
      } else if (contactType === 'email') {
        const email = String(data.targetContact || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new HttpsError('invalid-argument', 'Enter a valid email address.');
        }
        targetContact = email;
      }

      const role = data.role === 'manager' ? 'manager' : 'staff';
      let permissions = Array.isArray(data.permissions) && data.permissions.length > 0 ? data.permissions : (role === 'manager' ? STAFF_PERMISSIONS : ['orders', 'catalog']);
      if (permissions.some(p => !STAFF_PERMISSIONS.includes(p))) {
        throw new HttpsError('invalid-argument', 'Invalid permissions requested.');
      }
      permissions = Array.from(new Set(permissions)).sort();

      const inviteCode = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const inviteData = {
        inviteCode,
        merchantId,
        merchantType,
        ownerUid: uid,
        contactType,
        targetContact,
        role,
        permissions,
        status: 'pending',
        createdAt: Timestamp.now(),
        expiresAt
      };

      await db.doc(`merchant_staff_invites/${inviteCode}`).set(inviteData);
      await recordActivity(merchantId, merchantType, uid, account?.name || 'Owner', 'staff_invite_created', {
        inviteCode,
        role,
        permissions,
        contactType,
        targetContact
      });

      return {
        success: true,
        inviteCode,
        role,
        permissions,
        contactType,
        targetContact,
        expiresAt,
        status: 'pending'
      };
    }),

    listMerchantStaffInvites: onCall({ operation: 'listMerchantStaffInvites', region: REGION }, async request => {
      const { uid } = await caller(request), { merchantId, merchantType } = parseBusiness(request.data);
      await verifyOwner(uid, merchantId, merchantType);

      const snap = await db.collection('merchant_staff_invites')
        .where('merchantId', '==', merchantId)
        .where('status', '==', 'pending')
        .limit(50)
        .get();

      const now = Date.now();
      const invites = snap.docs.map(doc => {
        const d = doc.data();
        const expTime = d.expiresAt?.toMillis ? d.expiresAt.toMillis() : new Date(d.expiresAt).getTime();
        return {
          inviteCode: d.inviteCode || doc.id,
          merchantId: d.merchantId,
          merchantType: d.merchantType,
          role: d.role || 'staff',
          permissions: d.permissions || [],
          contactType: d.contactType || 'code',
          targetContact: d.targetContact || null,
          status: expTime <= now ? 'expired' : d.status,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
          expiresAt: typeof d.expiresAt === 'string' ? d.expiresAt : new Date(expTime).toISOString()
        };
      }).filter(inv => inv.status === 'pending');

      return { invites };
    }),

    cancelMerchantStaffInvite: onCall({ operation: 'cancelMerchantStaffInvite', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {}, { merchantId, merchantType } = parseBusiness(data);
      await verifyOwner(uid, merchantId, merchantType);

      const inviteCode = String(data.inviteCode || '').trim().toUpperCase();
      if (!inviteCode) throw new HttpsError('invalid-argument', 'Invite code is required.');

      const inviteRef = db.doc(`merchant_staff_invites/${inviteCode}`);
      const snap = await inviteRef.get();
      if (!snap.exists || snap.data()?.merchantId !== merchantId) {
        throw new HttpsError('not-found', 'Invite not found.');
      }

      await inviteRef.update({
        status: 'cancelled',
        cancelledAt: Timestamp.now(),
        cancelledBy: uid
      });

      await recordActivity(merchantId, merchantType, uid, account?.name || 'Owner', 'staff_invite_cancelled', { inviteCode });
      return { cancelled: true };
    }),

    acceptMerchantStaffInvite: onCall({ operation: 'acceptMerchantStaffInvite', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {};
      const inviteCode = String(data.inviteCode || '').trim().toUpperCase();
      if (!inviteCode || !/^INV-[A-Z0-9]{4,16}$/.test(inviteCode)) {
        throw new HttpsError('invalid-argument', 'Enter a valid staff invite code (e.g. INV-XXXXXX).');
      }

      const inviteRef = db.doc(`merchant_staff_invites/${inviteCode}`);
      const inviteDoc = await inviteRef.get();
      if (!inviteDoc.exists) {
        throw new HttpsError('not-found', 'This staff invite code does not exist.');
      }
      const invite = inviteDoc.data();
      if (invite.status !== 'pending') {
        throw new HttpsError('failed-precondition', `This invite has already been ${invite.status}.`);
      }
      const expiresAtMillis = invite.expiresAt?.toMillis ? invite.expiresAt.toMillis() : new Date(invite.expiresAt).getTime();
      if (expiresAtMillis <= Date.now()) {
        throw new HttpsError('failed-precondition', 'This staff invite has expired.');
      }
      if (uid === invite.ownerUid) {
        throw new HttpsError('invalid-argument', 'Business owners cannot accept an invite to their own business.');
      }

      const { merchantId, merchantType, permissions = [], role = 'staff' } = invite;
      const memberRef = db.doc(`merchant_staff/${merchantId}/members/${uid}`);
      const counterRef = db.doc(`merchant_staff/${merchantId}`);
      const targetRef = db.doc(`users/${uid}`);
      const businessDoc = businessRef(merchantId, merchantType);

      await db.runTransaction(async tx => {
        const [target, member, counter, business] = await Promise.all([
          tx.get(targetRef),
          tx.get(memberRef),
          tx.get(counterRef),
          tx.get(businessDoc)
        ]);
        const profile = target.data();
        if (!target.exists || profile?.role !== 'merchant' || profile.disabled === true || profile.suspended === true || profile.accountAuthority === 'neon') {
          throw new HttpsError('failed-precondition', 'Staff must have an active AllGo merchant account.');
        }
        const current = { ...(profile.merchantStaffAccess || {}) };
        const existing = current[merchantId];
        if (existing && existing.ownerUid !== invite.ownerUid) {
          throw new HttpsError('failed-precondition', 'This account already has access to the business under a different owner.');
        }
        if (!existing && Object.keys(current).length >= 25) {
          throw new HttpsError('resource-exhausted', 'This staff account has reached its business access limit.');
        }
        const memberCount = counter.data()?.memberCount || 0;
        if (!member.exists && (!Number.isSafeInteger(memberCount) || memberCount < 0 || memberCount >= 100)) {
          throw new HttpsError('resource-exhausted', 'This business has reached its 100-account staff limit.');
        }

        current[merchantId] = { merchantType, ownerUid: invite.ownerUid, permissions: [...permissions].sort(), role };
        tx.set(memberRef, {
          staffUid: uid,
          merchantType,
          permissions: [...permissions].sort(),
          role,
          grantedBy: invite.ownerUid,
          inviteCode,
          updatedAt: Timestamp.now(),
          createdAt: member.data()?.createdAt || Timestamp.now()
        });
        tx.update(targetRef, { merchantStaffAccess: current });
        if (!member.exists) tx.set(counterRef, { memberCount: memberCount + 1 });
        tx.update(inviteRef, {
          status: 'accepted',
          acceptedBy: uid,
          acceptedAt: Timestamp.now()
        });
        tx.create(db.collection('operations_audit').doc(), {
          operatorId: uid,
          action: 'merchant_staff_invite_accepted',
          target: `${merchantType}:${merchantId}:${uid}`,
          inviteCode,
          permissions: [...permissions].sort(),
          createdAt: Timestamp.now()
        });
      });

      await recordActivity(merchantId, merchantType, uid, account?.name || account?.email || uid, 'staff_invite_accepted', {
        inviteCode,
        permissions,
        role
      });

      return {
        success: true,
        merchantId,
        merchantType,
        permissions,
        role
      };
    }),

    listMerchantStaffActivity: onCall({ operation: 'listMerchantStaffActivity', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {}, { merchantId, merchantType } = parseBusiness(data);
      if (!merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'You do not have access to view this business activity log.');
      }

      const limit = Math.min(Math.max(1, Number(data.limit) || 25), 100);
      const snap = await db.collection(`merchant_staff_activity/${merchantId}/events`)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const activities = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          action: d.action,
          actorId: d.actorId,
          actorName: d.actorName || 'Staff Member',
          merchantId: d.merchantId,
          merchantType: d.merchantType,
          details: d.details || {},
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt
        };
      });

      return { activities };
    }),

    logMerchantStaffActivity: onCall({ operation: 'logMerchantStaffActivity', region: REGION }, async request => {
      const { uid, account } = await caller(request), data = request.data || {}, { merchantId, merchantType } = parseBusiness(data);
      if (!merchantHasBusiness(account, merchantId, merchantType)) {
        throw new HttpsError('permission-denied', 'You do not have permission to log activity for this business.');
      }

      const action = String(data.action || '').trim();
      if (!action || action.length > 80) {
        throw new HttpsError('invalid-argument', 'Action name is required.');
      }

      await recordActivity(
        merchantId,
        merchantType,
        uid,
        account?.name || account?.email || uid,
        action,
        typeof data.details === 'object' && data.details !== null ? data.details : {}
      );

      return { success: true };
    })
  };
}

module.exports = { merchantStaffFunctions };
