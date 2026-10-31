/**
 * Tiered Roles:
 * - admin: Global governance, policy edits, superuser actions
 * - finance: High-value refunds, driver & merchant payout approvals, ledger reviews
 * - dispatch: Fleet management, order reassignment, zone surge configuration
 * - support: Ticket resolution, customer inquiries, evidence review, low-value refund requests
 */

const ROLE_PERMISSIONS = {
  admin: [
    'refund_request', 'refund_approve', 'refund_execute',
    'payout_request', 'payout_approve', 'payout_execute',
    'dispatch_override', 'partner_reassign', 'fleet_view',
    'support_ticket', 'evidence_review', 'policy_edit', 'journal_review'
  ],
  finance: [
    'refund_approve', 'refund_execute',
    'payout_approve', 'payout_execute',
    'journal_review', 'evidence_review'
  ],
  dispatch: [
    'dispatch_override', 'partner_reassign', 'fleet_view', 'support_ticket'
  ],
  support: [
    'support_ticket', 'refund_request', 'evidence_review', 'fleet_view'
  ]
};

// Monetary thresholds in integer paise
const MAKER_CHECKER_THRESHOLDS = {
  refund_approve: 50000,    // ₹500
  payout_approve: 1000000,  // ₹10,000
};

/**
 * Checks whether a given tiered role has permission for a specific action.
 */
function hasTieredPermission(role, action) {
  if (!role || typeof role !== 'string') return false;
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()];
  return Array.isArray(permissions) && permissions.includes(action);
}

/**
 * Determines whether a transaction amount requires dual maker-checker authorization.
 */
function requiresMakerChecker(action, amountPaise) {
  const threshold = MAKER_CHECKER_THRESHOLDS[action];
  if (threshold == null) return false;
  return Number.isSafeInteger(amountPaise) && amountPaise >= threshold;
}

/**
 * Validates a checker's approval on a maker-initiated request.
 * Enforces dual-control: checker must not be the maker, and must possess the required tiered permission.
 */
function validateMakerCheckerApproval(requestRecord, checkerUser) {
  if (!requestRecord || !requestRecord.makerId) {
    return { approved: false, reason: 'Malformed request record or missing initiator ID.' };
  }
  if (!checkerUser || !checkerUser.uid) {
    return { approved: false, reason: 'Invalid checker identity.' };
  }
  if (requestRecord.makerId === checkerUser.uid) {
    return { approved: false, reason: 'Maker cannot approve their own high-value transaction (dual control required).' };
  }
  const checkerRole = checkerUser.role || (checkerUser.admin ? 'admin' : '');
  const action = requestRecord.action || 'refund_approve';
  if (!hasTieredPermission(checkerRole, action)) {
    return { approved: false, reason: `Checker with role '${checkerRole}' is not authorized for '${action}'.` };
  }
  if (requestRecord.status === 'executed' || requestRecord.status === 'rejected') {
    return { approved: false, reason: `Request is already in terminal state: ${requestRecord.status}.` };
  }
  return { approved: true };
}

module.exports = {
  ROLE_PERMISSIONS,
  MAKER_CHECKER_THRESHOLDS,
  hasTieredPermission,
  requiresMakerChecker,
  validateMakerCheckerApproval,
};
