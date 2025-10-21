const dayjs = require('dayjs');

function generateAuthCode() {
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `AUTH-${random}`;
}

function validatePolicy(policy = {}) {
  const { provider, policyNo, validUntil } = policy;

  if (!provider || !policyNo || !validUntil) {
    return {
      ok: false,
      reason: 'Incomplete policy information'
    };
  }

  const isValid = dayjs(validUntil).isAfter(dayjs(), 'minute');

  if (!isValid) {
    return {
      ok: false,
      reason: 'Policy expired'
    };
  }

  return {
    ok: true,
    authCode: generateAuthCode()
  };
}

module.exports = {
  validatePolicy
};
