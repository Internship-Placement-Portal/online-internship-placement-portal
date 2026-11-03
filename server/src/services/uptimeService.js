
const mongoose = require('mongoose');
const Downtime = require('../models/Downtime');
const logger = require('../utils/logger');

let outageStartedAt = null;
let existingOutage = null;
let monitoringTimer = null;

async function initialize() {
  existingOutage = await Downtime.findOne({ status: 'ongoing' })
    .sort({ startedAt: -1 });

  if (existingOutage) {
    outageStartedAt = existingOutage.startedAt;

    logger.warn('Resuming existing downtime monitoring', {
      downtimeId: existingOutage._id.toString(),
    });
  }
}

async function checkAvailability() {
  const isAvailable = mongoose.connection.readyState === 1;

  if (!isAvailable && !outageStartedAt) {
    outageStartedAt = new Date();

    logger.error('Service downtime detected', {
      reason: 'MongoDB connection unavailable',
      startedAt: outageStartedAt.toISOString(),
    });
  }

  if (isAvailable && outageStartedAt) {
    const recoveredAt = new Date();
    const durationMs = recoveredAt - outageStartedAt;

    try {
      if (existingOutage) {
        await Downtime.findByIdAndUpdate(existingOutage._id, {
          recoveredAt,
          durationMs,
          status: 'recovered',
        });
      } else {
        await Downtime.create({
          startedAt: outageStartedAt,
          recoveredAt,
          durationMs,
          reason: 'MongoDB connection unavailable',
          status: 'recovered',
          scheduledMaintenance: false,
        });
      }

      logger.info('Service recovered', {
        recoveredAt: recoveredAt.toISOString(),
        durationMs,
      });

      outageStartedAt = null;
      existingOutage = null;
    } catch (err) {
      logger.error('Failed to record recovered downtime', {
        error: err.message,
      });
    }
  }

  return isAvailable;
}

function startMonitoring(intervalMs = 30000) {
  if (monitoringTimer) return;

  monitoringTimer = setInterval(() => {
    checkAvailability().catch((err) => {
      logger.error('Uptime monitoring check failed', {
        error: err.message,
      });
    });
  }, intervalMs);

  monitoringTimer.unref();
}

function stopMonitoring() {
  if (monitoringTimer) {
    clearInterval(monitoringTimer);
    monitoringTimer = null;
  }
}

module.exports = {
  initialize,
  checkAvailability,
  startMonitoring,
  stopMonitoring,
};
