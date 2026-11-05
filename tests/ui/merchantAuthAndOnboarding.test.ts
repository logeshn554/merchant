import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isValidIndianMobile,
  maskPhoneNumber
} from '../../src/components/AuthScreen';
import {
  mapCategoryToBackendType,
  validateStep,
  FOOD_CATEGORIES,
  DRAFT_STORAGE_KEY,
  type MerchantOnboardingDraft
} from '../../src/components/MerchantRegistrationWizard';

test('AuthScreen adheres to AllGo Merchant Partner branding and mobile validation', () => {
  const authScreenSrc = readFileSync(new URL('../../src/components/AuthScreen.tsx', import.meta.url), 'utf8');

  // Verify partner headings and labels
  assert.match(authScreenSrc, /Welcome to AllGo Partner/);
  assert.match(authScreenSrc, /Grow your business with AllGo\./);
  assert.match(authScreenSrc, /Enter your mobile number/);
  assert.match(authScreenSrc, /Register your business/);
  assert.match(authScreenSrc, /Verify your mobile number/);

  // Strictly exclude consumer promo content
  assert.doesNotMatch(authScreenSrc, /Food Delivery/i);
  assert.doesNotMatch(authScreenSrc, /Grocery & Instamart/i);
  assert.doesNotMatch(authScreenSrc, /Bike & Car Rides/i);
  assert.doesNotMatch(authScreenSrc, /Parcel Delivery/i);
  assert.doesNotMatch(authScreenSrc, /Everything you need/i);

  // Exclude demo bypasses and mock numbers
  assert.doesNotMatch(authScreenSrc, /1234567890/);
  assert.doesNotMatch(authScreenSrc, /isDemo/);

  // Test Indian mobile number validator
  assert.equal(isValidIndianMobile('9876543210'), true);
  assert.equal(isValidIndianMobile('+919876543210'), true);
  assert.equal(isValidIndianMobile('7012345678'), true);
  assert.equal(isValidIndianMobile('8123456789'), true);
  assert.equal(isValidIndianMobile('6381234567'), true);
  assert.equal(isValidIndianMobile('5876543210'), false, 'Indian mobile numbers do not start with 5');
  assert.equal(isValidIndianMobile('1234567890'), false, 'Indian mobile numbers do not start with 1');
  assert.equal(isValidIndianMobile('98765'), false, 'Must be 10 digits');
  assert.equal(isValidIndianMobile('98765432100'), false, 'Cannot exceed 10 digits');

  // Test Phone number masking
  assert.equal(maskPhoneNumber('9876543210'), '+91 98*** **210');
  assert.equal(maskPhoneNumber('+919876543210'), '+91 98*** **210');
  assert.equal(maskPhoneNumber('7012345678'), '+91 70*** **678');
});

test('MerchantRegistrationWizard category mappings and food safety requirements', () => {
  // Test category to backend vertical mapping
  assert.equal(mapCategoryToBackendType('restaurant'), 'restaurant');
  assert.equal(mapCategoryToBackendType('cloud_kitchen'), 'restaurant');
  assert.equal(mapCategoryToBackendType('bakery'), 'restaurant');
  assert.equal(mapCategoryToBackendType('home_kitchen'), 'home_kitchen');
  assert.equal(mapCategoryToBackendType('grocery'), 'grocery');
  assert.equal(mapCategoryToBackendType('supermarket'), 'grocery');
  assert.equal(mapCategoryToBackendType('handmade'), 'handmade');

  // Verify food categories require FSSAI
  assert.ok(FOOD_CATEGORIES.includes('restaurant'));
  assert.ok(FOOD_CATEGORIES.includes('cloud_kitchen'));
  assert.ok(FOOD_CATEGORIES.includes('bakery'));
  assert.ok(FOOD_CATEGORIES.includes('home_kitchen'));
  assert.ok(!FOOD_CATEGORIES.includes('grocery'));
  assert.ok(!FOOD_CATEGORIES.includes('handmade'));

  assert.equal(DRAFT_STORAGE_KEY, 'allgo_merchant_onboarding_draft');
});

test('MerchantRegistrationWizard validates each step correctly', () => {
  const baseDraft: MerchantOnboardingDraft = {
    step: 1,
    legalName: '',
    displayName: '',
    category: 'restaurant',
    ownerName: '',
    email: '',
    phone: '',
    businessConstitution: 'sole_proprietorship',
    addressLine: '',
    landmark: '',
    city: '',
    state: '',
    pinCode: '',
    latitude: null,
    longitude: null,
    deliveryRadiusKm: 5,
    fssaiNumber: '',
    fssaiExpiryDate: '',
    gstin: '',
    panNumber: '',
    tradeLicenseNumber: '',
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    payoutSchedule: 'weekly',
    openingTime: '09:00',
    closingTime: '22:00',
    weeklyOffDays: [],
    estimatedPrepTimeMins: 20,
    minOrderValueInr: 99,
    managerPhone: '',
    agreementAccepted: false,
  };

  // Step 1: Empty draft fails
  assert.match(validateStep(1, baseDraft)!, /legal business name/i);

  const step1Valid: MerchantOnboardingDraft = {
    ...baseDraft,
    legalName: 'Annapoorna Foods',
    displayName: 'Annapoorna Veg',
    ownerName: 'Ramesh',
    email: 'ramesh@annapoorna.com',
    phone: '9876543210'
  };
  assert.equal(validateStep(1, step1Valid), null);

  // Step 2: Location validation
  assert.match(validateStep(2, step1Valid)!, /address/i);
  const step2Valid: MerchantOnboardingDraft = {
    ...step1Valid,
    addressLine: '12, Main Road, RS Puram',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pinCode: '641002',
    deliveryRadiusKm: 6
  };
  assert.equal(validateStep(2, step2Valid), null);

  // Step 3: Verification & FSSAI (restaurant requires FSSAI)
  assert.match(validateStep(3, step2Valid)!, /PAN/i);
  const step3WithPan: MerchantOnboardingDraft = {
    ...step2Valid,
    panNumber: 'ABCDE1234F'
  };
  assert.match(validateStep(3, step3WithPan)!, /FSSAI/i);

  const step3ValidFood: MerchantOnboardingDraft = {
    ...step3WithPan,
    fssaiNumber: '12423001000123',
    fssaiExpiryDate: '2028-12-31'
  };
  assert.equal(validateStep(3, step3ValidFood), null);

  // Step 3: Grocery does not require FSSAI
  const step3Grocery: MerchantOnboardingDraft = {
    ...step3WithPan,
    category: 'grocery'
  };
  assert.equal(validateStep(3, step3Grocery), null);

  // Step 4: Bank & Payout
  assert.match(validateStep(4, step3ValidFood)!, /beneficiary name/i);
  const step4Mismatch: MerchantOnboardingDraft = {
    ...step3ValidFood,
    accountHolderName: 'Annapoorna Foods',
    accountNumber: '123456789012',
    confirmAccountNumber: '123456789999',
    ifscCode: 'SBIN0001234'
  };
  assert.match(validateStep(4, step4Mismatch)!, /do not match/i);

  const step4Valid: MerchantOnboardingDraft = {
    ...step4Mismatch,
    confirmAccountNumber: '123456789012'
  };
  assert.equal(validateStep(4, step4Valid), null);

  // Step 5: Store Setup
  assert.equal(validateStep(5, step4Valid), null);
  const step5InvalidPrep: MerchantOnboardingDraft = {
    ...step4Valid,
    estimatedPrepTimeMins: 2
  };
  assert.match(validateStep(5, step5InvalidPrep)!, /preparation time/i);

  // Step 6: Review & Agreement
  assert.match(validateStep(6, step4Valid)!, /accept the Merchant Partner Agreement/i);
  const step6Valid: MerchantOnboardingDraft = {
    ...step4Valid,
    agreementAccepted: true
  };
  assert.equal(validateStep(6, step6Valid), null);
});

test('MerchantStatusScreen source code handles all required operational states', () => {
  const statusScreenSrc = readFileSync(new URL('../../src/components/MerchantStatusScreen.tsx', import.meta.url), 'utf8');

  // Check state handling in source
  assert.match(statusScreenSrc, /Application Under Review/);
  assert.match(statusScreenSrc, /24-48 hours/);
  assert.match(statusScreenSrc, /Information Required/);
  assert.match(statusScreenSrc, /Reviewer Feedback/);
  assert.match(statusScreenSrc, /Enter Merchant Dashboard/);
  assert.match(statusScreenSrc, /Application Not Approved/);
  assert.match(statusScreenSrc, /Merchant Account Suspended/);
  assert.match(statusScreenSrc, /amendPartnerApplication/);
});

test('App.tsx routes merchant audience to onboarding wizard and status screens', () => {
  const appSrc = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');

  assert.match(appSrc, /MerchantRegistrationWizard/);
  assert.match(appSrc, /MerchantStatusScreen/);
  assert.match(appSrc, /listenToUserPartnerApplications/);
  assert.match(appSrc, /forceRegistrationView/);
});
