process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_AUTH_MAX = '1000';
process.env.RATE_LIMIT_API_MAX = '10000';
process.env.MONGOMS_VERSION = '7.0.14';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'ipp-test-uploads');
process.env.RATE_LIMIT_UPLOAD_MAX = '1000';
