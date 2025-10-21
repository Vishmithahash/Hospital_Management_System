const asyncHandler = require('../utils/asyncHandler')
const appointmentService = require('../services/appointments/appointment.service')
const availabilityService = require('../services/appointments/availability.service')
const { CANCEL_CUTOFF_HOURS } = require('../services/appointments/policy.service')

const book = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.book(req.body, req.user || {})
  res.status(201).json(appointment)
})

const cancel = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.cancel(req.params.id, req.user || {})
  res.status(200).json(appointment)
})

const reschedule = asyncHandler(async (req, res) => {
  const appointment = await appointmentService.reschedule(
    req.params.id,
    req.body,
    req.user || {}
  )
  res.status(200).json(appointment)
})

const getAvailableSlots = asyncHandler(async (req, res) => {
  const { doctorId } = req.params
  const { day } = req.query
  const slots = await availabilityService.getAvailableSlots(doctorId, day)
  res.status(200).json(slots)
})

const getPolicy = asyncHandler(async (req, res) => {
  res.status(200).json({
    cancelCutoffHours: CANCEL_CUTOFF_HOURS
  })
})

const list = asyncHandler(async (req, res) => {
  const results = await appointmentService.listUpcoming(undefined, req.user || {})
  res.status(200).json(results)
})

const listMe = asyncHandler(async (req, res) => {
  const results = await appointmentService.listForMe(req.user || {}, req.query)
  res.status(200).json(results)
})

const listDoctorMe = asyncHandler(async (req, res) => {
  const results = await appointmentService.listForDoctor(req.user || {}, req.query)
  res.status(200).json(results)
})

const listAdmin = asyncHandler(async (req, res) => {
  const results = await appointmentService.listForAdmin(req.user || {}, req.query)
  res.status(200).json(results)
})

const approve = asyncHandler(async (req, res) => {
  const result = await appointmentService.approve(req.params.id, req.user || {})
  res.status(200).json(result)
})

const reject = asyncHandler(async (req, res) => {
  const result = await appointmentService.reject(req.params.id, req.user || {})
  res.status(200).json(result)
})

module.exports = {
  book,
  cancel,
  reschedule,
  getAvailableSlots,
  getPolicy,
  list,
  listMe,
  listDoctorMe,
  listAdmin,
  approve,
  reject
}
