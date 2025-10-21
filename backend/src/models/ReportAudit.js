const { Schema, model } = require('mongoose');

const reportAuditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    filters: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

reportAuditSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('ReportAudit', reportAuditSchema);
