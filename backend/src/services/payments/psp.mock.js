const crypto = require('crypto');
const env = require('../../config/env');

function createIntent(amount) {
  const intentId = `intent_${crypto.randomUUID()}`;
  return {
    intentId,
    amount
  };
}

function extractSignature(source) {
  if (!source) {
    return undefined;
  }

  if (typeof source === 'string') {
    return source;
  }

  const headers = source.headers || source.get?.headers?.();

  if (headers) {
    return (
      headers['x-psp-signature'] ||
      headers['X-PSP-Signature'] ||
      headers['X-Psp-Signature']
    );
  }

  return undefined;
}

function verifySignature(source) {
  const signature = extractSignature(source);
  return signature === env.PSP_WEBHOOK_SECRET;
}

async function trigger(intentId, status) {
  return {
    ok: true,
    intentId,
    status
  };
}

module.exports = {
  createIntent,
  verifySignature,
  trigger
};
