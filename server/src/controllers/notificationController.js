const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

const list = asyncHandler(async (req, res) => res.json(await notificationService.list(req.user, req.query)));
const markRead = asyncHandler(async (req, res) => res.json({ notification: await notificationService.markRead(req.user, req.params.id) }));
const markAllRead = asyncHandler(async (req, res) => res.json(await notificationService.markAllRead(req.user)));

module.exports = { list, markRead, markAllRead };
