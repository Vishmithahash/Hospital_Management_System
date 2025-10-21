const { deidentify } = require('../services/reports/privacy.service');

describe('Reports privacy deidentification', () => {
  test('removes sensitive identifiers from rows', () => {
    const rows = [
      { patientId: 'p1', appointmentId: 'a1', actorId: 'u1', visits: 3, dept: 'OPD' },
      { visits: 1, dept: 'Cardiology' }
    ];
    const safe = deidentify(rows);
    expect(safe[0].patientId).toBeUndefined();
    expect(safe[0].appointmentId).toBeUndefined();
    expect(safe[0].actorId).toBeUndefined();
    expect(safe[0].visits).toBe(3);
    expect(safe[1]).toEqual({ visits: 1, dept: 'Cardiology' });
  });
});


