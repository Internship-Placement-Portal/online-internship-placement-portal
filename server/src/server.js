const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDb } = require('./config/db');
const uptimeService = require('./services/uptimeService');
const app = require('./app');
const { createServer } = require('./utils/createServer');

async function start() {
  await connectDb();
  await uptimeService.initialize();
  uptimeService.startMonitoring();
  if (config.jobsEnabled) {
    require('./jobs/expireListings').start();
    require('./jobs/autoSubmitAttempts').start();
  }
  const server = createServer(app);
  server.listen(config.port, () => logger.info(`IPP API listening on port ${config.port}`, { tls: Boolean(config.tls.certFile) }));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    uptimeService.stopMonitoring();

    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
