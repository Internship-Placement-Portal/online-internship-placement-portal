const Downtime = require('../models/Downtime');

const UPTIME_TARGET = 99.5;

async function getMonthlyUptime(year, month) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    throw new Error('Invalid year or month');
  }

  const now = Date.now();
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);

  if (monthStart > now) {
    throw new Error('Cannot calculate uptime for a future month');
  }

  // Completed months use their full duration.
  // The current month uses elapsed time only.
  const periodEnd = Math.min(monthEnd, now);
  const totalTimeMs = periodEnd - monthStart;

  const outages = await Downtime.find({
    startedAt: { $lt: new Date(periodEnd) },
    $or: [
      { recoveredAt: null },
      { recoveredAt: { $gt: new Date(monthStart) } },
    ],
    scheduledMaintenance: false,
  }).sort({ startedAt: 1 });

  const intervals = [];

  for (const outage of outages) {
    const start = Math.max(
      outage.startedAt.getTime(),
      monthStart
    );

    const end = Math.min(
      outage.recoveredAt
        ? outage.recoveredAt.getTime()
        : now,
      periodEnd
    );

    if (end > start) {
      intervals.push({ start, end });
    }
  }

  // Merge overlapping outage intervals to avoid double-counting.
  intervals.sort((a, b) => a.start - b.start);

  let downtimeMs = 0;
  let currentStart = null;
  let currentEnd = null;

  for (const interval of intervals) {
    if (currentStart === null) {
      currentStart = interval.start;
      currentEnd = interval.end;
    } else if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end);
    } else {
      downtimeMs += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
    }
  }

  if (currentStart !== null) {
    downtimeMs += currentEnd - currentStart;
  }

  const uptimePercentage = totalTimeMs > 0
    ? ((totalTimeMs - downtimeMs) / totalTimeMs) * 100
    : 100;

  return {
    year,
    month,
    uptimePercentage: Number(uptimePercentage.toFixed(3)),
    downtimeMs,
    target: UPTIME_TARGET,
    targetMet: uptimePercentage >= UPTIME_TARGET,
  };
}

module.exports = { getMonthlyUptime, UPTIME_TARGET };
