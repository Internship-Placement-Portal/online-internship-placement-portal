const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDb } = require('./config/db');
const app = require('./app');

async function start() {
  await connectDb();
  const server = app.listen(config.port, () => logger.info(`IPP API listening on port ${config.port}`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
