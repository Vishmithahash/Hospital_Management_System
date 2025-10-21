const { validatePolicy } = require('../patients/insurance.mock');

function authorizeInsurance(policy, amount) {
  const result = validatePolicy(policy);

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason
    };
  }

  return {
    ok: true,
    authCode: result.authCode,
    amount
  };
}

module.exports = {
  authorizeInsurance
};
