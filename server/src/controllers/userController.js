const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const getMe = (req, res) => res.json({ user: req.user.toSafeJSON() });
const updateMe = asyncHandler(async (req, res) => res.json({ user: await userService.updateProfile(req.user, req.body) }));

module.exports = { getMe, updateMe };
