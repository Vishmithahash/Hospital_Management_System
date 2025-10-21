const { stringify } = require('csv-stringify/sync');

function toCsv(columns, rows) {
  const csv = stringify(rows, {
    header: true,
    columns
  });

  return Buffer.from(csv, 'utf8');
}

module.exports = {
  toCsv
};
