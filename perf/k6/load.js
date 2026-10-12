// IPP-NF-001: page-load / API response time <= 3 s for 90% of requests under normal load (up to 500 concurrent users).
// IPP-NF-005: run the same script against 1 instance and then N instances to check near-linear scaling (see docs/PERFORMANCE.md).
//
//   k6 run -e BASE_URL=https://staging.example.com/api -e STUDENT_EMAIL=student@ipp.demo -e STUDENT_PASSWORD=... perf/k6/load.js
//   Optional: -e PEAK_VUS=500 -e RAMP=2m -e HOLD=5m
//
// The API rate limiter (SR-004) is per client IP, so a single load generator needs RATE_LIMIT_API_MAX raised on the
// system under test (never in production). Login happens once in setup(): access tokens are stateless JWTs, which is
// also what lets any instance serve any request.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:5000/api';
const PEAK = Number(__ENV.PEAK_VUS || 500);
const RAMP = __ENV.RAMP || '2m';
const HOLD = __ENV.HOLD || '5m';

const errors = new Rate('app_errors');
const searchTime = new Trend('listing_search_duration', true);

export const options = {
  stages: [
    { duration: RAMP, target: PEAK },
    { duration: HOLD, target: PEAK },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Acceptance criterion: 90th percentile <= 3 s.
    http_req_duration: ['p(90)<3000'],
    listing_search_duration: ['p(90)<2000'], // IPP-F-007: search within 2 s
    http_req_failed: ['rate<0.01'],
    app_errors: ['rate<0.01'],
  },
};

const QUERIES = ['', 'python', 'react', 'intern', 'cloud', 'design', 'analyst'];
const DOMAINS = ['', 'Software Development', 'Data Science', 'Web Development', 'Mobile Development'];

export function setup() {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: __ENV.STUDENT_EMAIL || 'student@ipp.demo', password: __ENV.STUDENT_PASSWORD || 'Demo@12345' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  const token = res.json('token');
  const list = http.get(`${BASE}/listings?limit=20`, { headers: { Authorization: `Bearer ${token}` } });
  const ids = (list.json('items') || []).map((l) => l.id);
  return { token, ids };
}

export default function (data) {
  const auth = { headers: { Authorization: `Bearer ${data.token}` } };
  const ok = (res, name) => {
    const pass = check(res, { [`${name} 200`]: (r) => r.status === 200 });
    errors.add(!pass);
  };

  group('browse + search', () => {
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    const res = http.get(`${BASE}/listings?q=${q}&domain=${encodeURIComponent(domain)}&page=1&limit=9`, auth);
    searchTime.add(res.timings.duration);
    ok(res, 'search');
  });
  sleep(Math.random() * 2 + 0.5);

  group('listing details', () => {
    if (data.ids.length) ok(http.get(`${BASE}/listings/${data.ids[Math.floor(Math.random() * data.ids.length)]}`, auth), 'detail');
  });
  sleep(Math.random() * 2 + 0.5);

  group('student dashboard', () => {
    ok(http.get(`${BASE}/dashboard/student`, auth), 'dashboard');
    ok(http.get(`${BASE}/applications/mine`, auth), 'applications');
    ok(http.get(`${BASE}/tests`, auth), 'tests');
  });
  sleep(Math.random() * 3 + 1);
}
