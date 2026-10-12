const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/adminService');

const ctxOf = (req) => ({ ip: req.ip });

const listRecruiters = asyncHandler(async (req, res) => res.json(await adminService.listRecruiters(req.query)));
const decideRecruiter = asyncHandler(async (req, res) =>
  res.json({ recruiter: await adminService.decideRecruiter(req.user, req.params.id, req.body, ctxOf(req)) })
);
const listListings = asyncHandler(async (req, res) => res.json(await adminService.listListings(req.query)));
const decideListing = asyncHandler(async (req, res) =>
  res.json({ listing: await adminService.decideListing(req.user, req.params.id, req.body, ctxOf(req)) })
);

module.exports = { listRecruiters, decideRecruiter, listListings, decideListing };
