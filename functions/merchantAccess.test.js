const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMerchantBusinessIds, merchantHasBusiness, merchantHasPermission, merchantBusinessOutlets, addMerchantBusiness, businessCollection } = require('./merchantAccess');

test('merchant outlet membership is type scoped and rejects inactive accounts', () => {
  const account = { role: 'merchant', merchantId: 'main', merchantType: 'restaurant', merchantBusinessIds: { restaurant: ['branch'], grocery: ['market'] } };
  assert.equal(merchantHasBusiness(account, 'main', 'restaurant'), true);
  assert.equal(merchantHasBusiness(account, 'branch', 'restaurant'), true);
  assert.equal(merchantHasBusiness(account, 'market', 'grocery'), true);
  assert.equal(merchantHasBusiness(account, 'branch', 'grocery'), false);
  assert.equal(merchantHasBusiness({ ...account, role: 'customer' }, 'branch', 'restaurant'), false);
  assert.equal(merchantHasBusiness({ ...account, suspended: true }, 'branch', 'restaurant'), false);
});

test('merchant outlet lists and mutations preserve bounds, uniqueness and the primary outlet', () => {
  const account = { role: 'merchant', merchantId: 'main', merchantType: 'restaurant', merchantBusinessIds: { restaurant: ['branch'] } };
  assert.deepEqual(merchantBusinessOutlets(account), [
    { merchantId: 'branch', merchantType: 'restaurant' },
    { merchantId: 'main', merchantType: 'restaurant' },
  ]);
  assert.deepEqual(addMerchantBusiness(account, 'branch', 'restaurant').restaurant, ['branch']);
  assert.throws(() => addMerchantBusiness({ merchantBusinessIds: { restaurant: Array.from({ length: 25 }, (_, i) => `branch_${i}`) } }, 'branch_extra', 'restaurant'), /outlet limit/);
  assert.throws(() => normalizeMerchantBusinessIds({ restaurant: ['same', 'same'] }), /valid, unique IDs/);
});

test('staff grants are constrained to one outlet and explicit work permissions', () => {
  const staff = { role: 'merchant', merchantStaffAccess: { branch: { merchantType: 'restaurant', ownerUid: 'owner', permissions: ['orders'] } } };
  assert.equal(merchantHasBusiness(staff, 'branch', 'restaurant'), true);
  assert.equal(merchantHasBusiness(staff, 'main', 'restaurant'), false);
  assert.equal(merchantHasPermission(staff, 'branch', 'restaurant', 'orders'), true);
  assert.equal(merchantHasPermission(staff, 'branch', 'restaurant', 'catalog'), false);
  assert.deepEqual(merchantBusinessOutlets(staff), [{ merchantId: 'branch', merchantType: 'restaurant' }]);
  const malformed = { role: 'merchant', merchantStaffAccess: { branch: { merchantType: 'restaurant', ownerUid: 'owner', permissions: ['orders', 'orders'] } } };
  assert.equal(merchantHasPermission(malformed, 'branch', 'restaurant', 'orders'), false);
});

test('new seller assignments are isolated from legacy collections and remain permission scoped', () => {
  const account = { role: 'merchant', merchantBusinessAssignments: { maker_1: { vertical: 'handmade', permissions: ['catalog', 'orders'] } } };
  assert.equal(businessCollection('handmade'), 'merchant_businesses');
  assert.equal(businessCollection('home_kitchen'), 'merchant_businesses');
  assert.equal(merchantHasBusiness(account, 'maker_1', 'handmade'), true);
  assert.equal(merchantHasBusiness(account, 'maker_1', 'grocery'), false);
  assert.equal(merchantHasPermission(account, 'maker_1', 'handmade', 'catalog'), true);
  assert.equal(merchantHasPermission(account, 'maker_1', 'handmade', 'orders'), true);
});
