// Runs in its own process: HTTPS enforcement is read from the environment when the app loads.
process.env.FORCE_HTTPS = 'true';
process.env.TRUST_PROXY = 'true';

const fs = require('fs');
const os = require('os');
const path = require('path');
const tls = require('tls');
const https = require('https');
const { spawnSync } = require('child_process');
const { describe, it, before, after } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const { createServer } = require('../src/utils/createServer');

describe('HTTPS enforcement (IPP-SR-001, IPP-NF-003)', () => {
  it('redirects plain-HTTP GETs to HTTPS and refuses plain-HTTP writes', async () => {
    const redirect = await request(app).get('/api/health?x=1').set('Host', 'ipp.example.com');
    expect(redirect.status).toBe(308);
    expect(redirect.headers.location).toBe('https://ipp.example.com/api/health?x=1');

    const post = await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: 'x' });
    expect(post.status).toBe(403);
    expect(post.body.code).toBe('HTTPS_REQUIRED');
  });

  it('serves requests that arrived over TLS (via the proxy header) and sends HSTS', async () => {
    const res = await request(app).get('/api/health').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
  });

  it('keeps /health reachable over HTTP for load-balancer probes', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
  });
});

describe('TLS 1.2+ only when Node terminates TLS (IPP-SR-001)', () => {
  let dir;
  let server;
  let port;
  let opensslOk = false;

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipp-tls-'));
    const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'key.pem', '-out', 'cert.pem', '-days', '1', '-subj', '/CN=localhost'], { cwd: dir });
    opensslOk = gen.status === 0;
    if (!opensslOk) return;
    server = createServer(app, { certFile: path.join(dir, 'cert.pem'), keyFile: path.join(dir, 'key.pem'), minVersion: 'TLSv1.2' });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });
  after(() => {
    if (server) server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('completes a TLS 1.2+ handshake and serves the API over HTTPS', async (t) => {
    if (!opensslOk) return t.skip('openssl not available');
    const proto = await new Promise((resolve, reject) => {
      const s = tls.connect({ port, host: '127.0.0.1', rejectUnauthorized: false, minVersion: 'TLSv1.2' }, () => {
        const v = s.getProtocol();
        s.end();
        resolve(v);
      });
      s.on('error', reject);
    });
    expect(['TLSv1.2', 'TLSv1.3'].includes(proto)).toBe(true);

    const body = await new Promise((resolve, reject) => {
      https.get({ host: '127.0.0.1', port, path: '/api/health', rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
    expect(body.status).toBe(200);
  });

  it('rejects clients that only offer TLS 1.1 or lower', async (t) => {
    if (!opensslOk) return t.skip('openssl not available');
    const outcome = await new Promise((resolve) => {
      const s = tls.connect({ port, host: '127.0.0.1', rejectUnauthorized: false, maxVersion: 'TLSv1.1', minVersion: 'TLSv1', ciphers: 'DEFAULT@SECLEVEL=0' }, () => {
        s.end();
        resolve('connected');
      });
      s.on('error', () => resolve('rejected'));
    });
    expect(outcome).toBe('rejected');
  });

  it('is configured with a TLS 1.2 floor', () => {
    expect(require('../src/config/env').tls.minVersion).toBe('TLSv1.2');
  });
});
