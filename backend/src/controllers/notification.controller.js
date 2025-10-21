const asyncHandler = require('../utils/asyncHandler');
const Notification = require('../models/Notification');

const list = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unreadOnly || 'false').toLowerCase() === 'true';
  const query = { userId: req.user.id };
  if (unreadOnly) query.isRead = false;
  const items = await Notification.find(query).sort({ createdAt: -1 }).limit(50).lean();
  res.status(200).json(items);
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { $set: { isRead: true } },
    { new: true }
  ).lean();
  res.status(200).json(updated);
});

const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true } });
  res.status(200).json({ ok: true });
});

module.exports = {
  list,
  markRead,
  markAllRead
};

