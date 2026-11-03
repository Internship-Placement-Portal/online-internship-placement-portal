const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

function registerDatabaseEvents() {
  mongoose.connection.on('disconnected', () => {
    logger.error('MongoDB connection lost');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB connection restored');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', {
      error: err.message,
    });
  });
}

async function connectDb(uri = config.mongoUri) {
  // Optional: some networks hand Node an unusable resolver, which breaks mongodb+srv:// lookups.
  if (config.dnsServers.length) dns.setServers(config.dnsServers);

  mongoose.set('strictQuery', true);

  registerDatabaseEvents();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  logger.info('MongoDB connected');
}

module.exports = { connectDb };