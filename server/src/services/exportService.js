const PDFDocument = require('pdfkit');

// IPP-F-021: CSV and PDF renderers for the placement analytics export.
const HEADERS = ['Application ID', 'Student', 'Email', 'College', 'Company', 'Internship', 'Domain', 'Location', 'Applied on', 'Status', 'Last updated'];
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const rowCells = (r) => [String(r._id), r.studentName, r.studentEmail, r.college || '', r.company, r.title, r.domain, r.location, iso(r.createdAt), r.status, iso(r.updatedAt)];

// Cells starting with = + - @ are prefixed so spreadsheet apps cannot execute them as formulas (CSV injection).
function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const lines = [HEADERS, ...rows.map(rowCells)].map((cells) => cells.map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`; // BOM so Excel opens UTF-8 correctly
}

const COLS = [
  ['Student', 105, (r) => r.studentName],
  ['Company', 90, (r) => r.company],
  ['Internship', 135, (r) => r.title],
  ['Applied', 55, (r) => iso(r.createdAt)],
  ['Status', 60, (r) => r.status],
];

function toPdf({ summary, rows }, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'IPP Placement Report' } });
  doc.pipe(stream);
  const { kpis, filters } = summary;
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  doc.fontSize(20).fillColor('#312e81').text('IPP — Placement Analytics Report');
  doc.moveDown(0.3).fontSize(9).fillColor('#475569').text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  doc.text(`Period: ${filters.from} to ${filters.to}${filters.company ? ` · Company: ${filters.company}` : ' · All companies'}`);

  doc.moveDown().fontSize(13).fillColor('#0f172a').text('Key metrics');
  const kpiRows = [
    ['Placement rate', `${kpis.placementRate}% (${kpis.placedStudents} of ${kpis.totalStudents} students)`],
    ['Applications', String(kpis.applications)],
    ['Selections', `${kpis.selections} (${kpis.conversionRate}% of applications)`],
    ['Shortlisted', String(kpis.shortlisted)],
    ['Test attempts', `${kpis.testAttempts} (average accuracy ${kpis.avgTestAccuracy}%)`],
  ];
  doc.fontSize(10);
  kpiRows.forEach(([k, v]) => {
    doc.fillColor('#475569').text(k, left, doc.y + 3, { continued: true, width: 140 }).fillColor('#0f172a').text(`  ${v}`);
  });

  const table = (title, head, body, widths) => {
    doc.moveDown().fontSize(13).fillColor('#0f172a').text(title);
    drawRow(head, widths, true);
    body.forEach((r) => drawRow(r, widths, false));
  };
  function drawRow(cells, widths, header) {
    if (doc.y > doc.page.height - 70) doc.addPage();
    const y = doc.y + 2;
    let x = left;
    doc.fontSize(header ? 8.5 : 8.5).fillColor(header ? '#312e81' : '#0f172a').font(header ? 'Helvetica-Bold' : 'Helvetica');
    cells.forEach((c, i) => {
      doc.text(String(c ?? ''), x, y, { width: widths[i] - 6, height: 12, ellipsis: true, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + 13;
    doc.moveTo(left, doc.y - 1).lineTo(left + width, doc.y - 1).strokeColor(header ? '#312e81' : '#e2e8f0').lineWidth(0.5).stroke();
  }

  table(
    'Company-wise applications',
    ['Company', 'Applications', 'Shortlisted', 'Selected'],
    summary.companyWise.map((c) => [c.company, c.applications, c.shortlisted, c.selected]),
    [220, 100, 100, 100]
  );
  table(
    'Monthly trend',
    ['Month', 'Applications', 'Selections', 'Test attempts', 'Avg. accuracy'],
    summary.monthly.map((m) => [m.label, m.applications, m.selections, m.testAttempts, m.avgAccuracy == null ? '—' : `${m.avgAccuracy}%`]),
    [120, 100, 100, 100, 100]
  );

  doc.addPage();
  doc.fontSize(13).fillColor('#0f172a').font('Helvetica').text(`Application records (${rows.length})`);
  drawRow(COLS.map((c) => c[0]), COLS.map((c) => c[1] * 1.45), true);
  rows.forEach((r) => drawRow(COLS.map((c) => c[2](r)), COLS.map((c) => c[1] * 1.45), false));
  if (!rows.length) doc.fontSize(10).fillColor('#475569').text('No applications match the selected filters.');
  doc.end();
}

module.exports = { toCsv, toPdf, HEADERS, csvCell };
