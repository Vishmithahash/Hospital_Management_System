function deidentify(rows = []) {
  return rows.map((row) => {
    if (!row || typeof row !== 'object') {
      return row;
    }

    const clone = { ...row };
    delete clone.patientId;
    delete clone.appointmentId;
    delete clone.actorId;

    return clone;
  });
}

module.exports = {
  deidentify
};
