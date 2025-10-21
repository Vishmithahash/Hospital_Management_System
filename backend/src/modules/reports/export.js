const dayjs = require('dayjs');

async function exportPDF({ meta, table, chartImage }) {
  // Lazy-load to avoid requiring dependency unless needed
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];
  return await new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(16).text('Smart Healthcare Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Type: ${meta.type}`);
    doc.text(`Range: ${meta.range.from} to ${meta.range.to}`);
    doc.text(`Generated At: ${dayjs(meta.generatedAt).format('YYYY-MM-DD HH:mm')}`);
    doc.text(`Timezone: ${meta.tz}`);
    if (meta.note) doc.text(`Note: ${meta.note}`);
    doc.moveDown();

    const contentX = 40;
    const contentWidth = 520;

    if (chartImage) {
      try {
        const data = chartImage.replace(/^data:image\/(png|jpeg);base64,/, '');
        const buf = Buffer.from(data, 'base64');
        doc.fontSize(12).fillColor('#0f172a').text('Chart', contentX, doc.y, { underline: true });
        doc.moveDown(0.75);
        const chartTop = doc.y;
        const chartHeight = 240;
        doc.image(buf, contentX, chartTop, { fit: [contentWidth, chartHeight] });
        doc.y = chartTop + chartHeight + 24;
        doc.moveDown(0.5);
      } catch (_) {
        // ignore chart image errors
      }
    }

    const hasTable = Array.isArray(table.columns) && table.columns.length > 0;
    if (hasTable) {
      doc.fontSize(12).fillColor('#0f172a').text('Table', contentX, doc.y, { underline: true });
      doc.moveDown(0.75);

      const rowHeight = 20;
      const headerHeight = 24;
      const colWidth = contentWidth / table.columns.length;
      const maxRows = 1000;
      const drawRow = (values, y, { header = false, zebra = false } = {}) => {
        if (y + rowHeight > doc.page.height - 40) {
          doc.addPage();
          y = 60;
        }
        if (header) {
          doc.save();
          doc.rect(contentX, y - 6, contentWidth, headerHeight).fill('#0ea5e9');
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
          values.forEach((val, idx) => {
            doc.text(String(val ?? ''), contentX + idx * colWidth + 6, y, {
              width: colWidth - 12,
              align: 'left'
            });
          });
          doc.restore();
          return y + headerHeight;
        }

        doc.save();
        if (zebra) {
          doc.rect(contentX, y - 4, contentWidth, rowHeight).fill('#f8fafc');
        }
        doc.fillColor('#0f172a').font('Helvetica').fontSize(10);
        values.forEach((val, idx) => {
          doc.text(String(val ?? ''), contentX + idx * colWidth + 6, y, {
            width: colWidth - 12,
            align: 'left'
          });
        });
        doc.restore();
        return y + rowHeight;
      };

      let currentY = doc.y;
      currentY = drawRow(table.columns, currentY, { header: true });
      table.rows.slice(0, maxRows).forEach((row, idx) => {
        const values = table.columns.map((col) => row[col]);
        currentY = drawRow(values, currentY + (idx === 0 ? 4 : 0), { zebra: idx % 2 === 0 });
      });
      doc.y = currentY + 16;
    }

    doc.end();
  });
}

async function exportExcel({ meta, table }) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.addRow(table.columns);
  table.rows.forEach((row) => {
    ws.addRow(table.columns.map((c) => row[c]));
  });

  ws.getRow(1).font = { bold: true };
  ws.columns = table.columns.map(() => ({ width: 20 }));

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { exportPDF, exportExcel };

