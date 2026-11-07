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

// IPP-SR-001 / TC-Sec-02: Cryptographic TLS and transport security configuration validator.
// Verifies compliance with SRS TLS 1.2+ minimum version requirements and disallows weak ciphers.
const DISALLOWED_PROTOCOLS = ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.0', 'TLSv1.1'];
const DISALLOWED_CIPHER_SUBSTRINGS = ['RC4', 'DES', 'MD5', 'NULL', 'EXPORT', 'anon'];

function validateTlsConfiguration(tlsConfig = {}) {
  const minVersion = tlsConfig.minVersion || 'TLSv1.2';
  if (DISALLOWED_PROTOCOLS.includes(minVersion)) {
    throw new Error(`Insecure TLS minimum version: ${minVersion}. Minimum required is TLSv1.2`);
  }

  if (tlsConfig.ciphers) {
    const ciphersList = typeof tlsConfig.ciphers === 'string' ? tlsConfig.ciphers.split(':') : tlsConfig.ciphers;
    for (const cipher of ciphersList) {
      if (DISALLOWED_CIPHER_SUBSTRINGS.some((weak) => cipher.toUpperCase().includes(weak))) {
        throw new Error(`Insecure cipher detected: ${cipher}`);
      }
    }
  }

  return {
    valid: true,
    minVersion,
    enforcedCiphersGrade: 'A',
  };
}

module.exports = { createServer, validateTlsConfiguration };
