const dayjs = require('dayjs');
const { z } = require('zod');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');

const baseDateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

const withRangeValidation = (schema) =>
  schema.superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from must be before to',
        path: ['from']
      });
    }
  });

const dateRangeSchema = withRangeValidation(baseDateRangeSchema);

const visitsFiltersSchema = withRangeValidation(
  baseDateRangeSchema.extend({
    department: z.string().trim().optional()
  })
);

const revenueFiltersSchema = withRangeValidation(
  baseDateRangeSchema.extend({
    method: z.enum(['INSURANCE', 'CARD', 'CASH', 'GOVERNMENT']).optional()
  })
);

const statusFiltersSchema = dateRangeSchema;

function normaliseRange(filters = {}) {
  const parsed = dateRangeSchema.parse(filters);
  const to = parsed.to ? dayjs(parsed.to) : dayjs();
  const from = parsed.from ? dayjs(parsed.from) : to.subtract(30, 'day');

  return {
    from: from.startOf('day').toDate(),
    to: to.endOf('day').toDate()
  };
}

function applyDefaults(filters = {}) {
  const range = normaliseRange(filters);

  return {
    ...filters,
    ...range
  };
}

async function visitsReport(filters = {}) {
  const validated = visitsFiltersSchema.parse(filters);
  const { from, to } = applyDefaults(validated);

  const match = {
    startsAt: { $gte: from, $lte: to }
  };

  if (validated.department) {
    match.department = validated.department;
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$startsAt' }
          }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id.day',
        count: 1
      }
    },
    { $sort: { date: 1 } }
  ];

  return Appointment.aggregate(pipeline);
}

async function revenueReport(filters = {}) {
  const validated = revenueFiltersSchema.parse(filters);
  const { from, to } = applyDefaults(validated);

  const match = {
    status: 'SUCCESS',
    createdAt: { $gte: from, $lte: to }
  };

  if (validated.method) {
    match.method = validated.method;
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          method: '$method'
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id.day',
        method: '$_id.method',
        total: 1,
        count: 1
      }
    },
    { $sort: { date: 1, method: 1 } }
  ];

  return Payment.aggregate(pipeline);
}

async function appointmentsStatusReport(filters = {}) {
  const validated = statusFiltersSchema.parse(filters);
  const { from, to } = applyDefaults(validated);

  const pipeline = [
    {
      $match: {
        startsAt: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1
      }
    },
    { $sort: { status: 1 } }
  ];

  return Appointment.aggregate(pipeline);
}

module.exports = {
  applyDefaults,
  visitsReport,
  revenueReport,
  appointmentsStatusReport
};
