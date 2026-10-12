const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('../config/env');

// Builds the HTTP(S) server. With TLS_CERT_FILE/TLS_KEY_FILE the API terminates TLS itself and refuses anything below TLS 1.2
// (IPP-SR-001); otherwise it speaks plain HTTP and is expected to sit behind a TLS-terminating proxy (see docs/SECURITY.md).
function createServer(app, tls = config.tls) {
  if (tls.certFile && tls.keyFile) {
    return https.createServer(
      {
        key: fs.readFileSync(tls.keyFile),
        cert: fs.readFileSync(tls.certFile),
        minVersion: tls.minVersion || 'TLSv1.2',
      },
      app
    );
  }
  return http.createServer(app);
}

module.exports = { createServer };
