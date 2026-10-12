const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const logger = require('./utils/logger');
const sanitize = require('./middleware/sanitize');
const httpsOnly = require('./middleware/httpsOnly');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(httpsOnly);
app.use(helmet({ hsts: { maxAge: 63072000, includeSubDomains: true, preload: true } })); // HSTS: browsers stay on HTTPS (SR-001)
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(sanitize);

// Request metadata only: never bodies, headers or tokens (SAD 4.4).
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', apiLimiter, require('./routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
