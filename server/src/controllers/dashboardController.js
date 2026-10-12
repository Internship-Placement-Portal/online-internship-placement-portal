const asyncHandler = require('../utils/asyncHandler');
const analyticsService = require('../services/analyticsService');
const exportService = require('../services/exportService');
const auditService = require('../services/auditService');

const student = asyncHandler(async (req, res) => res.json(await analyticsService.student(req.user)));
const placement = asyncHandler(async (req, res) => res.json(await analyticsService.placement(req.query)));

// IPP-F-021: the exported file reflects exactly the filters in the query string.
const exportPlacement = asyncHandler(async (req, res) => {
  const data = await analyticsService.exportData(req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  await auditService.record({
    actor: req.user._id,
    action: 'ANALYTICS_EXPORTED',
    metadata: { format: req.query.format, records: data.rows.length, from: data.summary.filters.from, to: data.summary.filters.to, company: data.summary.filters.company || undefined },
    ip: req.ip,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ipp-placement-${stamp}.csv"`);
    return res.send(exportService.toCsv(data.rows));
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ipp-placement-${stamp}.pdf"`);
  return exportService.toPdf(data, res);
});

module.exports = { student, placement, exportPlacement };
