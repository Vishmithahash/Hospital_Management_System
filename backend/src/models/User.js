const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'manager', 'admin'],
      default: 'patient'
    },
    linkedPatientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      default: null
    },
    profile: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
      imageUrl: { type: String, trim: true },
      age: { type: Number, min: 0 },
      doctorId: { type: String, trim: true },
      specialty: { type: String, trim: true }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('User', userSchema);
