const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

async function connectDb(uri = config.mongoUri) {
  // Optional: some networks hand Node an unusable resolver, which breaks mongodb+srv:// lookups.
  if (config.dnsServers.length) dns.setServers(config.dnsServers);
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info('MongoDB connected');
}

module.exports = { connectDb };
