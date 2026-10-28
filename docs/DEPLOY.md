> **Optional.** Deploying is not required for this project (confirmed by the course instructor); the app runs and is tested locally. This guide is kept for reference only.

# Deploying on Render

`render.yaml` defines three services: `ipp-api` (Node), `ipp-scoring` (Python/Flask), `ipp-client` (static site).

1. **Atlas:** Network Access -> allow `0.0.0.0/0` (Render free instances have no fixed IP). Copy the connection string.
2. **SMTP:** needed, or nobody can verify their email (OTP) or reset a password. Any provider works (Brevo, Gmail app password...).
3. Render dashboard -> **New -> Blueprint** -> select this repo. Enter the `sync: false` values. Use the same random
   `SCORING_SERVICE_TOKEN` on `ipp-api` and `ipp-scoring`.
4. Deploy order is circular for URLs, so: deploy once, then fill in `CLIENT_ORIGIN` (api), `SCORING_SERVICE_URL` (api) and
   `VITE_API_URL` (client, ends in `/api`) with the real `*.onrender.com` URLs and redeploy `ipp-api` and `ipp-client`.
5. **Create the admin** from your machine (free plan has no shell), pointing at Atlas:
   `cd server && MONGODB_URI=<atlas uri> ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin`
   (optionally `npm run seed:demo`).

## Known limits on the free plan
- Instances sleep after ~15 min idle; the first request takes ~30-60 s. This will skew NF-001/NF-002 numbers.
- **Resume uploads are stored on local disk, which Render wipes on every deploy/restart.** For real use, attach a paid persistent
  disk (set `UPLOAD_DIR` to its mount path) or switch `StorageService` to object storage.
