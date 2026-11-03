const { describe, it, before, after, beforeEach } = require('node:test');
const expect = require('./expect');
const Downtime = require('../src/models/Downtime');
const {
  getMonthlyUptime,
  UPTIME_TARGET,
} = require('../src/services/uptimeReportService');
const {
  startDb,
  stopDb,
  clearDb,
} = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('Monthly uptime calculation (IPP-NF-002)', () => {
  it('calculates uptime and excludes scheduled maintenance', async () => {
    await Downtime.create([
      {
        startedAt: new Date('2026-10-05T10:00:00Z'),
        recoveredAt: new Date('2026-10-05T11:00:00Z'),
        scheduledMaintenance: false,
      },
      {
        startedAt: new Date('2026-10-10T10:00:00Z'),
        recoveredAt: new Date('2026-10-10T12:00:00Z'),
        scheduledMaintenance: true,
      },
    ]);

    const report = await getMonthlyUptime(2026, 10);

    const monthDuration = Date.UTC(2026, 10, 1) -
      Date.UTC(2026, 9, 1);

    expect(report.downtimeMs).toBe(60 * 60 * 1000);
    expect(report.uptimePercentage).toBe(
      Number(((1 - 3600000 / monthDuration) * 100).toFixed(3))
    );
    expect(report.target).toBe(UPTIME_TARGET);
    expect(report.targetMet).toBe(true);
  });

  it('does not double-count overlapping downtime intervals', async () => {
    await Downtime.create([
      {
        startedAt: new Date('2026-10-05T10:00:00Z'),
        recoveredAt: new Date('2026-10-05T12:00:00Z'),
        scheduledMaintenance: false,
      },
      {
        startedAt: new Date('2026-10-05T11:00:00Z'),
        recoveredAt: new Date('2026-10-05T13:00:00Z'),
        scheduledMaintenance: false,
      },
    ]);

    const report = await getMonthlyUptime(2026, 10);

    expect(report.downtimeMs).toBe(3 * 60 * 60 * 1000);
  });

  it('rejects a future month', async () => {
    const now = new Date();
    const nextMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1
    ));

    let error;

    try {
      await getMonthlyUptime(
        nextMonth.getUTCFullYear(),
        nextMonth.getUTCMonth() + 1
      );
    } catch (err) {
      error = err;
    }

    expect(error.message).toBe('Cannot calculate uptime for a future month');
  });

  it('counts an ongoing outage only up to the report month end', async () => {
    await Downtime.create({
      startedAt: new Date('2026-10-31T23:00:00Z'),
      recoveredAt: null,
      status: 'ongoing',
      scheduledMaintenance: false,
    });

    const report = await getMonthlyUptime(2026, 10);

    expect(report.downtimeMs).toBe(60 * 60 * 1000);
  });

  it('reports when monthly uptime falls below 99.5%', async () => {
    await Downtime.create({
      startedAt: new Date('2026-10-05T10:00:00Z'),
      recoveredAt: new Date('2026-10-05T15:00:00Z'),
      scheduledMaintenance: false,
    });

    const report = await getMonthlyUptime(2026, 10);

    expect(report.uptimePercentage).toBe(99.328);
    expect(report.targetMet).toBe(false);
  });
});
