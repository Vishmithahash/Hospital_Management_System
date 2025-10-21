const { Schema, model } = require('mongoose');

const imageAttachmentSchema = new Schema(
  {
    patientId: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    caption: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('ImageAttachment', imageAttachmentSchema);

