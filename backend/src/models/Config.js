const { Schema, model } = require('mongoose');

const configSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('Config', configSchema);

