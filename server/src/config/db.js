const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

async function connectDb(uri = config.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info('MongoDB connected');
}

module.exports = { connectDb };
