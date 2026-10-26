# Performance and scalability (IPP-NF-001, IPP-NF-005)

## Targets (SRS 5)

| ID | Requirement | Acceptance |
|---|---|---|
| IPP-NF-001 | Page load and API response ≤ 3 s for 90 % of requests under normal load (up to 500 concurrent users) | p90 ≤ 3 s in a k6/JMeter run (TC-Perf-01) |
| IPP-NF-005 | API scales horizontally to 5× the baseline concurrent load | Load test at 5× baseline shows near-linear scaling with added instances (TC-Scale-01) |
| IPP-F-007 | Search/filter responds within 2 s | covered by a separate k6 threshold |

## How to run the load test

Two tools are provided:

| Tool | Where | When |
|---|---|---|
| **k6 scenario** | `perf/k6/load.js` | The real NF-001 / NF-005 evidence. Ramps to 500 virtual users, fails the run if p90 > 3 s, error rate ≥ 1 %, or search p90 > 2 s. |
| **Node benchmark** | `perf/bench.js` | Zero-dependency smoke check that runs anywhere (Node 18+). Prints p50 / p90 / p99, RPS and the error rate. |

```bash
# k6 (install from https://k6.io) — against a staging deployment
k6 run -e BASE_URL=https://staging.example.com/api \
       -e STUDENT_EMAIL=student@ipp.demo -e STUDENT_PASSWORD='Demo@12345' \
       -e PEAK_VUS=500 perf/k6/load.js

# Node benchmark — against a local server
node perf/bench.js --url http://localhost:5000 --concurrency 50 --requests 1500
```

**Before load testing**, raise the per-IP limiter on the *system under test only* (a single load generator is one IP, and
IPP-SR-004 correctly rate-limits it):

```bash
RATE_LIMIT_API_MAX=1000000 RATE_LIMIT_AUTH_MAX=100000 npm start   # never in production
```

Seed first (`npm run seed:demo`) so listings, applications and tests exist. Login happens once per run; access tokens are
stateless JWTs, so virtual users share one.

## Measurements taken during development

> Environment: Windows laptop running the API **and** the load generator, talking to a **remote MongoDB Atlas cluster over a
> home internet link**. These numbers describe that setup, not production. `k6` was not installed on the development machine,
> so the k6 script has been written and reviewed but **not executed**; the figures below come from `perf/bench.js`.

| Concurrency | Requests | RPS | p50 | p90 | p99 | Errors |
|---|---|---|---|---|---|---|
| 20 | 800 | 31 | 854 ms | **969 ms** | 1.9 s | 0 |
| 50 | 1 500 | 33 | 1.3 s | **2.2 s** | 3.1 s | 0 |
| 100 | 1 500 | 35 | 2.9 s | 4.0 s | 5.0 s | 0 |

Reading the numbers:

* p90 stays under the 3 s target up to ~50 concurrent clients on this setup and degrades past that.
* Throughput plateaus at ~35 requests/s no matter how many clients are added. Running **two API instances at once**
  (ports 5000 and 5001, same database) gave 18 + 19 ≈ 37 RPS combined — i.e. the ceiling is **shared downstream** (database
  round-trips over the home link), not the Node process. A single request costs 2–3 database round-trips (auth lookup plus the
  query/count), so latency to the database dominates.
* Consequently the 500-user / 5× scaling criteria **cannot be demonstrated from this laptop**. They need a staging run with
  the API co-located with its database (same region/VPC), a production-grade cluster tier (M10+) and the k6 script above.

### Things the code already does for NF-001

* Compound and text indexes on listings (`status, deadline, domain, location, stipend, duration` + text index on title/description/skills/company);
  indexes on `Application (student, listing)` (unique), `(listing, status, createdAt)`, `TestAttempt (student, test, attemptNo)`, `Notification (user, createdAt)`.
* All list endpoints are paginated (`limit` capped at 50–100) and use `lean()` where documents are read-only.
* Independent queries run in parallel (`Promise.all`) — search + count, dashboards, analytics facets (one `$facet` aggregation).
* No bcrypt work on the read path (hashing only at register / login / reset).

### What to do if production misses the target

1. Deploy the API in the same region/VPC as the cluster and use `mongodb+srv` with TLS (default).
2. Move to an M10+ Atlas tier; keep `maxPoolSize` ≥ expected concurrency per instance.
3. Cache the per-request user lookup in `middleware/auth.js` for a few seconds (trade-off: role changes / deactivation then take
   up to that long to apply; today they apply immediately and a test asserts it).
4. Add a Redis-backed rate-limit store and cache for hot read endpoints (domains, listing search pages).

## Horizontal scaling and running the API statelessly (IPP-NF-005)

The API keeps **no per-user state in process memory**, so any instance can serve any request:

| Concern | How it is handled | Action when scaling out |
|---|---|---|
| Sessions | None. Access tokens are signed JWTs; refresh tokens are opaque, hashed and stored in MongoDB (rotated, revocable). | — *Verified*: a token and a refresh cookie issued by instance A were accepted by instance B. |
| Config | Environment variables only (`server/.env.example`). Same `JWT_ACCESS_SECRET` on every instance. | Distribute the secret via your secret manager. |
| File uploads | Resumes are written to local disk behind `storageService`. | **Mount shared storage** (EFS / NFS) at `UPLOAD_DIR`, or replace `storageService` with an S3 implementation (same 4-function interface). Without this, a resume uploaded through instance A is not visible on instance B. |
| Rate limiting | `express-rate-limit` memory store → counters are per instance, so the effective limit is N × the configured value. | Plug in a shared store (e.g. `rate-limit-redis`) for exact global limits. |
| Background jobs | Listing expiry and test auto-submit run in every instance. They are idempotent (`updateMany` guards; attempts are finalised with an atomic `findOneAndUpdate`) so duplicates are harmless. | Optionally set `JOBS_ENABLED=false` on all but one instance. |
| Scoring | Runs in-process; swappable via `scoringService.setScorer()` for a separate Flask service. | — |
| TLS / proxy | Terminate TLS at the load balancer; set `TRUST_PROXY=true`. | See `docs/SECURITY.md`. |
| Health checks | `GET /health` (also exempt from the HTTPS redirect). | Point the load balancer at it. |

Suggested scaling test (TC-Scale-01): run `perf/k6/load.js` with `PEAK_VUS=100` against one instance to establish the baseline
RPS at p90 ≤ 3 s, then `PEAK_VUS=500` against five instances behind a load balancer, and compare RPS per instance.


### Local k6 smoke test — 10 virtual users

**Environment:** Local Windows development machine, API running on port 5000, local MongoDB, and k6.

**Configuration:** 10 maximum virtual users, 15-second ramp-up, 30-second hold.

| Metric | Result | Configured threshold | Status |
|---|---:|---:|---|
| HTTP requests | 492 | — | Informational |
| HTTP request failure rate | 0.00% | Below 1% | Pass |
| Application error rate | 0.00% | Below 1% | Pass |
| HTTP response p90 | 99.04 ms | Below 3,000 ms | Pass |
| Listing search p90 | 79.93 ms | Below 2,000 ms | Pass |

All configured k6 thresholds passed in this local smoke test. This result demonstrates successful API behavior at a maximum of 10 virtual users in the tested environment. It does not establish performance at 500 concurrent users or prove horizontal scaling to five times the baseline.

**Note:** The local rate-limit settings were raised for this test. Production rate limits must remain appropriately configured and should be tested separately.
