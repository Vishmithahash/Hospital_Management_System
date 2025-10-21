const asyncHandler = require('../utils/asyncHandler');
const paymentService = require('../services/payments/payment.service');

const payByCard = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  const result = await paymentService.handleCardPayment(req.body, actor);
  res.status(201).json(result);
});

const payByCash = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  const result = await paymentService.handleCashPayment(req.body, actor);
  res.status(201).json(result);
});

const payByGovernment = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  const result = await paymentService.handleGovernmentPayment(req.body, actor);
  res.status(201).json(result);
});

const getReceipt = asyncHandler(async (req, res) => {
  const actor = req.user || {};
  const receipt = await paymentService.getReceipt(req.params.id, actor);
  res.status(200).json(receipt);
});

module.exports = {
  payByCard,
  payByCash,
  payByGovernment,
  getReceipt
};

