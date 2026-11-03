const { describe, it, before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');
const expect = require('./expect');
const Downtime = require('../src/models/Downtime');
const uptimeService = require('../src/services/uptimeService');
const { startDb, stopDb, clearDb } = require('./helpers');

before(startDb);
after(() => {
  uptimeService.stopMonitoring();
  return stopDb();
});
beforeEach(async () => {
  uptimeService.stopMonitoring();
  await clearDb();
});

describe('Uptime monitoring service (IPP-NF-002)', () => {
  it('detects database unavailability', async () => {
    await uptimeService.initialize();

    mongoose.connection.readyState = 0;

    const result = await uptimeService.checkAvailability();

    expect(result).toBe(false);
  });

  it('records downtime after database recovery', async () => {
    await uptimeService.initialize();

    mongoose.connection.readyState = 0;
    await uptimeService.checkAvailability();

    mongoose.connection.readyState = 1;
    await uptimeService.checkAvailability();

    const record = await Downtime.findOne({ status: 'recovered' });

    expect(record).not.toBe(null);
    expect(record.reason).toBe('MongoDB connection unavailable');
    expect(record.recoveredAt instanceof Date).toBe(true);
    expect(record.durationMs >= 0).toBe(true);
  });
});