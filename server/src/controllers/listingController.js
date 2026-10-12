const asyncHandler = require('../utils/asyncHandler');
const listingService = require('../services/listingService');

const search = asyncHandler(async (req, res) => res.json(await listingService.search(req.query)));
const domains = (req, res) => res.json({ domains: listingService.domains() });
const mine = asyncHandler(async (req, res) => res.json(await listingService.listMine(req.user, req.query)));
const getOne = asyncHandler(async (req, res) => res.json({ listing: await listingService.getById(req.user, req.params.id) }));
const create = asyncHandler(async (req, res) => res.status(201).json({ listing: await listingService.create(req.user, req.body) }));
const update = asyncHandler(async (req, res) => res.json({ listing: await listingService.update(req.user, req.params.id, req.body) }));
const close = asyncHandler(async (req, res) => res.json({ listing: await listingService.close(req.user, req.params.id) }));

module.exports = { search, domains, mine, getOne, create, update, close };
