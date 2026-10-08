const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');
const userRepository = require('../repositories/userRepository');

// Verifies the Bearer JWT and loads the current user (so deactivation / role changes take effect immediately).
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Access token expired');
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_TOKEN', 'Invalid access token');
  req.user = user;
  next();
});

module.exports = { authenticate };
