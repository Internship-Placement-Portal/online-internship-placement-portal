const logger = require('../utils/logger');
const listingRepository = require('../repositories/listingRepository');

const INTERVAL_MS = 10 * 60 * 1000;

// IPP-F-009: scheduled sweep marks approved listings past their deadline as closed.
// (Student queries also filter by deadline, so listings vanish immediately, not just at the next sweep.)
async function run() {
  try {
    const res = await listingRepository.closeExpired();
    if (res.modifiedCount) logger.info('Closed expired listings', { count: res.modifiedCount });
    return res.modifiedCount;
  } catch (err) {
    logger.error('expireListings failed', { error: err.message });
    return 0;
  }
}

function start() {
  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  return timer;
}

module.exports = { run, start };
