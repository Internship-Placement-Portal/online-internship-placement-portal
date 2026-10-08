const RefreshToken = require('../models/RefreshToken');

const create = (data) => RefreshToken.create(data);
const findByHash = (tokenHash) => RefreshToken.findOne({ tokenHash });
const revoke = (id, replacedBy) =>
  RefreshToken.updateOne({ _id: id, revokedAt: { $exists: false } }, { revokedAt: new Date(), ...(replacedBy && { replacedBy }) });
const revokeAllForUser = (user) =>
  RefreshToken.updateMany({ user, revokedAt: { $exists: false } }, { revokedAt: new Date() });

module.exports = { create, findByHash, revoke, revokeAllForUser };
