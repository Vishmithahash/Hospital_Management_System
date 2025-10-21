const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CARD_STATUS = {
  SUCCESS: 'SUCCESS',
  DECLINED: 'DECLINED',
  NETWORK_ERROR: 'NETWORK_ERROR'
};

const CARD_MATRIX = {
  '4111111111111111': CARD_STATUS.SUCCESS,
  '4000000000000002': CARD_STATUS.DECLINED,
  '4084084084084084': CARD_STATUS.NETWORK_ERROR
};

function randomLatency() {
  return 800 + Math.floor(Math.random() * 400);
}

async function processCard({ cardNumber, amount }) {
  await delay(randomLatency());
  const status = CARD_MATRIX[cardNumber] || CARD_STATUS.SUCCESS;

  if (status === CARD_STATUS.SUCCESS) {
    return {
      status,
      gatewayRef: `mock_${Date.now()}`,
      authCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      amount
    };
  }

  return { status };
}

module.exports = {
  CARD_STATUS,
  processCard
};

