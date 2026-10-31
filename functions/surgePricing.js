'use strict';

const MIN_SURGE_MULTIPLIER = 1.0;
const MAX_SURGE_MULTIPLIER = 2.5; // Transparent safety cap on surge pricing
const DRIVER_SURGE_PASS_THROUGH_RATE = 0.80; // 80% of surge markup credited to driver partner

/**
 * Validate operator surge multiplier configuration.
 * @param {number} multiplier
 */
function validateSurgeMultiplier(multiplier) {
  if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) {
    return { valid: false, error: 'Surge multiplier must be a finite number.' };
  }
  if (multiplier < MIN_SURGE_MULTIPLIER) {
    return { valid: false, error: `Surge multiplier cannot be less than ${MIN_SURGE_MULTIPLIER}x.` };
  }
  if (multiplier > MAX_SURGE_MULTIPLIER) {
    return { valid: false, error: `Surge multiplier cannot exceed safety cap of ${MAX_SURGE_MULTIPLIER}x.` };
  }
  return { valid: true, multiplier };
}

/**
 * Calculate fare breakdown including transparent surge markup and driver incentive.
 * @param {object} params
 * @param {number} params.baseFarePaise
 * @param {number} params.surgeMultiplier
 */
function calculateSurgeFare({ baseFarePaise, surgeMultiplier = 1.0 }) {
  if (!Number.isInteger(baseFarePaise) || baseFarePaise <= 0) {
    throw new Error('Base fare must be a positive integer in paise.');
  }

  const valid = validateSurgeMultiplier(surgeMultiplier);
  if (!valid.valid) {
    throw new Error(valid.error);
  }

  const multiplier = valid.multiplier;
  const surgePaise = multiplier > 1.0
    ? Math.round(baseFarePaise * (multiplier - 1.0))
    : 0;

  const totalFarePaise = baseFarePaise + surgePaise;
  const driverSurgeBonusPaise = Math.round(surgePaise * DRIVER_SURGE_PASS_THROUGH_RATE);

  return {
    baseFarePaise,
    surgeMultiplier: multiplier,
    surgePaise,
    totalFarePaise,
    driverSurgeBonusPaise,
    isSurgeApplied: multiplier > 1.0
  };
}

module.exports = {
  MIN_SURGE_MULTIPLIER,
  MAX_SURGE_MULTIPLIER,
  DRIVER_SURGE_PASS_THROUGH_RATE,
  validateSurgeMultiplier,
  calculateSurgeFare
};
