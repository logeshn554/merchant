'use strict';

/**
 * Reusable bank account and UPI validation rules adhering to RBI & NPCI specifications.
 */
function validateBeneficiaryName(name, HttpsError) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new HttpsError('invalid-argument', 'Enter a valid beneficiary account holder name (2-100 characters).');
  }
  return trimmed;
}

function validateBankPayoutDetails({ accountNumber, ifscCode, bankName, beneficiaryName }, HttpsError) {
  const name = validateBeneficiaryName(beneficiaryName, HttpsError);
  const acct = String(accountNumber || '').trim();
  if (!/^\d{9,18}$/.test(acct)) {
    throw new HttpsError('invalid-argument', 'Enter a valid bank account number (9 to 18 digits).');
  }
  const ifsc = String(ifscCode || '').trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    throw new HttpsError('invalid-argument', 'Enter a valid 11-character Indian Financial System Code (IFSC).');
  }
  const bName = typeof bankName === 'string' ? bankName.trim().slice(0, 80) : '';
  const maskedAccount = `••••${acct.slice(-4)}`;
  return {
    accountType: 'bank',
    beneficiaryName: name,
    accountNumber: acct,
    ifscCode: ifsc,
    bankName: bName,
    maskedAccount,
  };
}

function validateUpiPayoutDetails({ upiId, beneficiaryName }, HttpsError) {
  const name = validateBeneficiaryName(beneficiaryName, HttpsError);
  const upi = String(upiId || '').trim().toLowerCase();
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi)) {
    throw new HttpsError('invalid-argument', 'Enter a valid UPI ID (e.g. drivername@bank).');
  }
  const atIdx = upi.indexOf('@');
  const maskedAccount = `••••${upi.slice(Math.max(0, atIdx - 2))}`;
  return {
    accountType: 'upi',
    beneficiaryName: name,
    upiId: upi,
    maskedAccount,
  };
}

module.exports = {
  validateBeneficiaryName,
  validateBankPayoutDetails,
  validateUpiPayoutDetails,
};
