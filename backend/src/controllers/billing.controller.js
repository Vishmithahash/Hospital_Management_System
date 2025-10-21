const asyncHandler = require('../utils/asyncHandler');
const billingService = require('../services/billing/billing.service');

const buildLatest = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const actor = req.user || {};
  const bill = await billingService.buildLatestBill(patientId, actor);
  res.status(200).json(bill);
});

const getCurrent = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const actor = req.user || {};
  const bill = await billingService.getCurrentBill(patientId, actor);
  res.status(200).json(bill);
});

module.exports = {
  buildLatest,
  getCurrent
};

