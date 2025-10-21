const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payments/payment.service');

const getReceipt = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  const receipt = await paymentService.getReceipt(req.params.id, actor);
  res.status(200).json(receipt);
});

module.exports = {
  getReceipt
};

