const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ role: user.role }, config.jwt.accessSecret, {
    subject: String(user._id || user.id),
    expiresIn: `${config.jwt.accessExpiresMin}m`,
    issuer: config.jwt.issuer,
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  });
}

const randomToken = () => crypto.randomBytes(48).toString('base64url');
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

module.exports = { signAccessToken, verifyAccessToken, randomToken, sha256, generateOtp };
