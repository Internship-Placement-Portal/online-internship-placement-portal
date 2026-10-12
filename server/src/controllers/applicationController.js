const asyncHandler = require('../utils/asyncHandler');
const applicationService = require('../services/applicationService');

const ctxOf = (req) => ({ ip: req.ip });

const apply = asyncHandler(async (req, res) => {
  res.status(201).json({ application: await applicationService.apply(req.user, req.body, req.file) });
});
const mine = asyncHandler(async (req, res) => res.json(await applicationService.listMine(req.user, req.query)));
const forListing = asyncHandler(async (req, res) =>
  res.json(await applicationService.listForListing(req.user, req.params.id, req.query))
);
const getOne = asyncHandler(async (req, res) => res.json({ application: await applicationService.getOne(req.user, req.params.id) }));

const resume = asyncHandler(async (req, res) => {
  const { stream, filename } = await applicationService.openResume(req.user, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

const updateStatus = asyncHandler(async (req, res) =>
  res.json({ application: await applicationService.updateStatus(req.user, req.params.id, req.body, ctxOf(req)) })
);
const scheduleInterview = asyncHandler(async (req, res) =>
  res.json({ application: await applicationService.scheduleInterview(req.user, req.params.id, req.body, ctxOf(req)) })
);

module.exports = { apply, mine, forListing, getOne, resume, updateStatus, scheduleInterview };
