const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('../config/env');

// Builds the HTTP(S) server. With TLS_CERT_FILE/TLS_KEY_FILE the API terminates TLS itself and refuses anything below TLS 1.2
// (IPP-SR-001); otherwise it speaks plain HTTP and is expected to sit behind a TLS-terminating proxy (see docs/SECURITY.md).
function createServer(app, tls = config.tls) {
if (tls.certFile && tls.keyFile) {
  const minVersion = tls.minVersion || 'TLSv1.2';
  const supportedVersions = ['TLSv1.2', 'TLSv1.3'];

  if (!supportedVersions.includes(minVersion)) {
    throw new Error('TLS minimum version must be TLSv1.2 or TLSv1.3');
  }
    return https.createServer(
      {
        key: fs.readFileSync(tls.keyFile),
        cert: fs.readFileSync(tls.certFile),
        minVersion: minVersion,
      },
      app
    );
  }
  return http.createServer(app);
}

module.exports = { createServer };
