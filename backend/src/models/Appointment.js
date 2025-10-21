const { Schema, model } = require('mongoose');

const appointmentSchema = new Schema(
  {
    patientId: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['BOOKED', 'CONFIRMED', 'APPROVED', 'ACCEPTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      default: 'BOOKED'
    },
    notes: { type: String, trim: true },
    previousAppointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

appointmentSchema.index({ doctorId: 1, startsAt: 1 }, { unique: true });

module.exports = model('Appointment', appointmentSchema);
