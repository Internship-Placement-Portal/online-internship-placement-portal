const logger = require('../utils/logger');
const testService = require('../services/testService');

const INTERVAL_MS = 30 * 1000;

// IPP-F-014: attempts whose timer reached zero are submitted automatically even if the student closed the browser.
async function run() {
  try {
    const n = await testService.autoSubmitExpired();
    if (n) logger.info('Auto-submitted expired attempts', { count: n });
    return n;
  } catch (err) {
    logger.error('autoSubmitAttempts failed', { error: err.message });
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
