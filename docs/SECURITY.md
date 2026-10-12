# Security configuration (IPP-SR-001 … SR-006, IPP-NF-003)

This document explains how each security requirement is met, what you must configure when deploying, and how it is tested.

## 1. TLS 1.2+ for all connections (IPP-SR-001, IPP-NF-003)

### Browser ⇄ API

Two supported deployments; **plain HTTP is never served in production** either way.

**A. TLS terminated by a reverse proxy / load balancer (recommended).** Example nginx server block:

```nginx
server {
  listen 443 ssl http2;
  server_name ipp.example.com;

  ssl_certificate     /etc/letsencrypt/live/ipp.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ipp.example.com/privkey.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;            # nothing older
  ssl_prefer_server_ciphers off;
  ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
  ssl_session_timeout 1d;
  ssl_session_cache   shared:SSL:10m;
  ssl_session_tickets off;
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

  location /api/ { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host;
                   proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $remote_addr; }
  location /     { root /var/www/ipp-client; try_files $uri /index.html; }   # built React app (client/dist)
}
server { listen 80; server_name ipp.example.com; return 301 https://$host$request_uri; }
```

API environment: `NODE_ENV=production`, `TRUST_PROXY=true` (so `req.secure` honours `X-Forwarded-Proto`), `FORCE_HTTPS` (on by default in production),
`CLIENT_ORIGIN=https://ipp.example.com`. The refresh-token cookie is `Secure; HttpOnly; SameSite=Lax` in production.

**B. TLS terminated by Node.** Set `TLS_CERT_FILE` and `TLS_KEY_FILE`; the server is created with `minVersion: 'TLSv1.2'`
(`server/src/utils/createServer.js`).

What the code enforces regardless of deployment (`middleware/httpsOnly.js`, `app.js`):

* `FORCE_HTTPS` (default **on** in production): plain-HTTP `GET`/`HEAD` → `308` redirect to HTTPS; any other method → `403 HTTPS_REQUIRED`
  (credentials/tokens sent over HTTP are never processed). `/health` stays reachable over HTTP for load-balancer probes.
* `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` on every response.
* Production refuses to start with `MAIL_TRANSPORT=console`.

### API ⇄ database, API ⇄ mail provider

* MongoDB Atlas (`mongodb+srv://…`) uses TLS by default (TLS 1.2+); the self-hosted `mongodb://` URI should add `?tls=true`.
* SMTP: `tls.minVersion = TLSv1.2`, and `requireTLS` is on in production so credentials and mail are never sent in plaintext.
* Server-to-microservice: the scoring service is in-process today. If it is split out (Flask), call it over HTTPS only.

### Verification

* `tests/https-enforcement.test.js` — redirect/refusal over HTTP, HSTS header, and a real TLS server: handshake negotiates
  TLS 1.2/1.3 and a client that only offers TLS ≤ 1.1 is rejected.
* Network scan (TC-Sec-02): `nmap --script ssl-enum-ciphers -p 443 ipp.example.com` should list only TLSv1.2/TLSv1.3, and
  `curl -I http://ipp.example.com/api/health` should return `308` to `https://`. (Run against the deployed environment.)

## 2. Sensitive data at rest (IPP-NF-003, IPP-F-003)

| Data | Protection |
|---|---|
| Passwords | bcrypt with per-password salt (`BCRYPT_ROUNDS`, default 12); `passwordHash` is `select: false` and never returned. |
| Email OTPs, password-reset tokens, refresh tokens | Only a SHA-256 hash is stored; raw values exist only in the email / cookie. OTPs are single-use, expiring, attempt-limited. |
| JWT secret | Environment variable only; ≥ 32 characters enforced in production. |
| Resumes | Stored under random 128-bit names (never user-supplied), outside the web root, served only through an authorised endpoint (`Cache-Control: private, no-store`). |
| Database files | Enable encryption at rest on the cluster (Atlas encrypts at rest by default; self-hosted: WiredTiger encryption / encrypted volumes). |
| Logs | Request metadata only — never bodies, headers, tokens or passwords. Audit metadata contains no secrets. |

## 3. Authentication and sessions (IPP-SR-002)

* Access token: JWT (HS256, `iss=ipp-api`), lifetime `JWT_ACCESS_EXPIRES_MIN` **capped at 60 minutes** in code (default 15).
* Refresh token: opaque, httpOnly cookie scoped to `/api/auth`, rotated on every use; re-use of a revoked token revokes the user's whole token family; logout and password reset revoke tokens.
* Account lockout after 5 failed logins for 15 minutes (IPP-F-004), audit-logged.

## 4. Input validation and injection defence (IPP-SR-003)

* Joi validation on every route (`validate` middleware; unknown keys stripped; ids validated as 24-hex).
* `sanitize` middleware drops `$`/dotted keys (NoSQL operator injection) and strips markup from strings. Passwords/OTPs are never altered;
  code answers and question-bank text are exempt because they legitimately contain `<`/`>` and are only rendered as text by React.
* Regex filters escape user input; CSV export neutralises spreadsheet formulas.
* `helmet` security headers; CORS restricted to `CLIENT_ORIGIN`; JSON body limit 100 kB.
* ZAP baseline (TC-Sec-04): `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://staging.example.com` against a staging deployment.

## 5. Rate limiting (IPP-SR-004)

`express-rate-limit`: global API limiter, a stricter limiter on auth routes (`RATE_LIMIT_AUTH_MAX`) and on resume upload
(`RATE_LIMIT_UPLOAD_MAX`); excess → `429 RATE_LIMITED`. Counters are per instance (see `docs/PERFORMANCE.md` for a shared store).

## 6. File uploads (IPP-SR-005)

PDF only (extension **and** MIME **and** `%PDF-` magic bytes **and** `%%EOF` trailer), ≤ 5 MB (multer limit + re-check),
buffered in memory, **scanned before anything is written to disk**: built-in active-content scanner (JavaScript, Launch,
EmbeddedFile, RichMedia), plus an optional ClamAV daemon (`CLAMAV_HOST`/`CLAMAV_PORT`). Scanners fail *closed*; extra scanners can be added with `scanService.registerScanner()`.

## 7. Authorisation (IPP-SR-006, IPP-F-023)

* RBAC at the route layer (`authenticate` + `authorize(roles…)`); ownership checks in services (recruiters see only their listings/applicants, students only their applications/attempts).
* Every out-of-role call returns `403` and writes an `RBAC_DENIED` audit entry.
* `server/tests/rbac-matrix.test.js` reads the live route table and asserts, for **every** endpoint, `401` for anonymous callers, `403` for each non-permitted role and success past the gate for permitted roles. Adding an endpoint without declaring its access fails the suite.

## 8. Audit trail (IPP-F-024)

Approvals, listing reviews, status changes, interviews, test/question administration, re-enables, exports, lockouts and RBAC denials are recorded with actor, timestamp, target and IP; admins browse them under **Admin → Audit log**.

## Deployment checklist

- [ ] `NODE_ENV=production`, strong unique `JWT_ACCESS_SECRET` (≥ 32 chars)
- [ ] TLS in front (or `TLS_CERT_FILE`/`TLS_KEY_FILE`), `TRUST_PROXY=true` behind a proxy
- [ ] `CLIENT_ORIGIN` set to the real HTTPS origin; `COOKIE_SAMESITE=none` only if the client is on a different site (requires HTTPS)
- [ ] SMTP configured (`SMTP_HOST` …); `MAIL_TRANSPORT` not `console`
- [ ] MongoDB user with least privilege, IP allow-list, TLS, encryption at rest
- [ ] Shared `UPLOAD_DIR` (or S3 storage) if running more than one instance
- [ ] Remove demo accounts / change `ADMIN_PASSWORD`, never run `seed:demo` in production
