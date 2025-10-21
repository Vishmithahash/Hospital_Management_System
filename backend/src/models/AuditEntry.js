const { Schema, model } = require('mongoose');

const auditEntrySchema = new Schema(
  {
    entity: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true, trim: true },
    at: { type: Date, default: Date.now },
    diff: { type: Schema.Types.Mixed }
  },
  {
    versionKey: false
  }
);

auditEntrySchema.index({ entity: 1, entityId: 1, at: -1 });

module.exports = model('AuditEntry', auditEntrySchema);
