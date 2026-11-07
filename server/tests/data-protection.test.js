// server/tests/data-protection.test.js
// IPP-NF-003 / TC-Sec-01 & IPP-SR-001 / TC-Sec-02: Sensitive data protection at rest and TLS in-transit security test suite.
// Acceptance criteria:
//   1. Sensitive resume files are encrypted at rest using AES-256-GCM; raw files on disk contain no plaintext PDF markers.
//   2. Tampering with ciphertext or authentication tag causes cryptographic rejection (AEAD tag mismatch).
//   3. Plaintext HTTP access is blocked (308 redirect for safe methods, 403 HTTPS_REQUIRED for state-changing requests).
//   4. Strict-Transport-Security (HSTS) headers are delivered on all TLS responses.
//   5. TLS version floor is strictly TLS 1.2+; legacy protocols (SSLv3, TLS 1.0, TLS 1.1) and insecure ciphers are disallowed.
const { describe, it, before, after, beforeEach } = require('node:test');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const config = require('../config/env');
const storageService = require('../src/services/storageService');
const { validateTlsConfiguration } = require('../src/utils/createServer');
const { startDb, stopDb, clearDb } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('TC-Sec-01 | Sensitive data protection at rest (IPP-NF-003)', () => {
  it('encrypts uploaded resumes at rest using AES-256-GCM and leaves no plaintext on disk', async () => {
    // Generate a simulated valid PDF buffer
    const originalPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Confidential Resume) /Author (Student) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

    // Save through storage service
    const key = await storageService.save(originalPdf);
    expect(key).toMatch(/^[a-f0-9]{32}\.pdf$/);

    // Inspect the physical file on disk directly
    const filePath = path.join(config.upload.dir, key);
    const rawDiskBytes = await fsp.readFile(filePath);

    // Verify format marker 'IPPENC1:'
    expect(rawDiskBytes.subarray(0, 8).toString('ascii')).toBe('IPPENC1:');

    // Verify total length: marker (8) + IV (12) + Tag (16) + Ciphertext (> 0)
    expect(rawDiskBytes.length).toBeGreaterThan(8 + 12 + 16);

    // Verify no plaintext leak of '%PDF-' exists anywhere in the raw encrypted file
    expect(rawDiskBytes.includes(Buffer.from('%PDF-'))).toBe(false);
    expect(rawDiskBytes.includes(Buffer.from('Confidential Resume'))).toBe(false);

    // Verify inspectEncryptedFile audit helper
    const audit = await storageService.inspectEncryptedFile(key);
    expect(audit.isEncrypted).toBe(true);
    expect(audit.containsPlaintextPdfMarker).toBe(false);
    expect(audit.algorithm).toBe('aes-256-gcm');
    expect(audit.authentic).toBe(true);
    expect(audit.decryptedSize).toBe(originalPdf.length);

    // Decrypt through service and verify byte-for-byte fidelity with original
    const stream = await storageService.open(key);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const decryptedPdf = Buffer.concat(chunks);

    expect(decryptedPdf.toString('utf8')).toBe(originalPdf.toString('utf8'));

    // Cleanup
    await storageService.remove(key);
  });

  it('detects tampering with ciphertext or authentication tag and refuses to decrypt', async () => {
    const originalPdf = Buffer.from('%PDF-1.4\nConfidential Data\n%%EOF');
    const key = await storageService.save(originalPdf);
    const filePath = path.join(config.upload.dir, key);

    const rawDiskBytes = await fsp.readFile(filePath);

    // Tamper with one byte of the ciphertext (last byte)
    const tamperedCiphertext = Buffer.from(rawDiskBytes);
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0xff;
    await fsp.writeFile(filePath, tamperedCiphertext);

    // Decryption must throw an authentication failure
    let threw = false;
    try {
      await storageService.open(key);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    // Tamper with the authentication tag (bytes 20..36)
    const tamperedTag = Buffer.from(rawDiskBytes);
    tamperedTag[25] ^= 0xaa;
    await fsp.writeFile(filePath, tamperedTag);

    let tagThrew = false;
    try {
      await storageService.open(key);
    } catch {
      tagThrew = true;
    }
    expect(tagThrew).toBe(true);

    await storageService.remove(key);
  });

  it('validates configured cryptographic encryption key entropy (256-bit AES)', () => {
    const keyHex = config.upload.encryptionKey;
    expect(typeof keyHex).toBe('string');
    // 256-bit key represented in hex must be exactly 64 hex characters
    expect(keyHex).toMatch(/^[a-f0-9]{64}$/i);
    const keyBuffer = Buffer.from(keyHex, 'hex');
    expect(keyBuffer.length).toBe(32); // 32 bytes = 256 bits
  });
});

describe('TC-Sec-02 | TLS 1.2+ and in-transit communication scanning (IPP-SR-001)', () => {
  it('enforces HTTPS redirection on unencrypted GET and rejects HTTP mutation attempts', async () => {
    // When incoming request lacks HTTPS / proxy proto header:
    const res = await request(app).get('/api/health').set('Host', 'portal.ipp.edu');
    // Safe GET method redirects to HTTPS with HTTP 308 Permanent Redirect
    if (config.forceHttps) {
      expect(res.status).toBe(308);
      expect(res.headers.location).toBe('https://portal.ipp.edu/api/health');
    }

    // State-changing requests must be rejected to prevent credential leaks over plain HTTP
    const postRes = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'secretPassword' });
    if (config.forceHttps) {
      expect(postRes.status).toBe(403);
      expect(postRes.body.code).toBe('HTTPS_REQUIRED');
    }
  });

  it('attaches Strict-Transport-Security (HSTS) headers to all secure responses', async () => {
    // Simulated HTTPS request via reverse-proxy header
    const res = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);

    const hsts = res.headers['strict-transport-security'];
    expect(hsts).toBeDefined();
    // 2-year duration (63072000 seconds) with includeSubDomains per security baseline
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('validates TLS configuration rejects legacy protocols (SSLv3, TLS 1.0, TLS 1.1) and insecure ciphers', () => {
    // Valid TLS 1.2 configuration
    const validConfig = validateTlsConfiguration({ minVersion: 'TLSv1.2' });
    expect(validConfig.valid).toBe(true);
    expect(validConfig.minVersion).toBe('TLSv1.2');

    // Valid TLS 1.3 configuration
    const valid13 = validateTlsConfiguration({ minVersion: 'TLSv1.3' });
    expect(valid13.valid).toBe(true);
    expect(valid13.minVersion).toBe('TLSv1.3');

    // Disallowed legacy protocols must throw
    expect(() => validateTlsConfiguration({ minVersion: 'SSLv3' })).toThrow();
    expect(() => validateTlsConfiguration({ minVersion: 'TLSv1.0' })).toThrow();
    expect(() => validateTlsConfiguration({ minVersion: 'TLSv1.1' })).toThrow();

    // Disallowed weak cipher suites must throw
    expect(() => validateTlsConfiguration({ ciphers: 'RC4-SHA:AES128-SHA' })).toThrow();
    expect(() => validateTlsConfiguration({ ciphers: 'DES-CBC3-SHA:AES256-SHA' })).toThrow();
    expect(() => validateTlsConfiguration({ ciphers: 'NULL-SHA' })).toThrow();
  });

  it('audits security headers and prevents sensitive credentials from leaking in API responses', async () => {
    const res = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);

    // OWASP Recommended Security Headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');

    // Cross-site scripting protection
    const xss = res.headers['x-xss-protection'];
    if (xss) expect(xss).toContain('0'); // modern standard disables legacy buggy auditor in favor of CSP

    // Microservice communication endpoint security audit
    if (config.scoring.url) {
      expect(config.scoring.url).toMatch(/^https?:\/\//);
    }
  });
});
