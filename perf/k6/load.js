// IPP-NF-001: page-load / API response time <= 8 s for 90% of requests under normal load (up to 5 concurrent users).
// IPP-NF-005: run the same script against 1 instance and then N instances to check near-linear scaling (see docs/PERFORMANCE.md).
//
//   k6 run -e BASE_URL=https://staging.example.com/api -e STUDENT_EMAIL=student@ipp.demo -e STUDENT_PASSWORD=... perf/k6/load.js
//   Optional: -e PEAK_VUS=5 -e RAMP=15s -e HOLD=30s
//
// The API rate limiter (SR-004) is per client IP, so a single load generator needs RATE_LIMIT_API_MAX raised on the
// system under test (never in production). Login happens once in setup(): access tokens are stateless JWTs, which is
// also what lets any instance serve any request.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:5000/api';
const PEAK = Number(__ENV.PEAK_VUS || 5);
const RAMP = __ENV.RAMP || '15s';
const HOLD = __ENV.HOLD || '30s';

const errors = new Rate('app_errors');
const searchTime = new Trend('listing_search_duration', true);
const detailTime = new Trend('listing_detail_duration', true);
const dashboardTime = new Trend('student_dashboard_duration', true);
const applicationsTime = new Trend('applications_duration', true);
const testsTime = new Trend('tests_list_duration', true);

export const options = {
  stages: [
    { duration: RAMP, target: PEAK },
    { duration: HOLD, target: PEAK },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // Acceptance criterion: 90th percentile <= 8 s.
    http_req_duration: ['p(90)<8000'],
    listing_search_duration: ['p(90)<5000'], // IPP-F-007: search within 5 s
    http_req_failed: ['rate<0.01'],
    app_errors: ['rate<0.01'],
  },
};

const QUERIES = ['', 'python', 'react', 'intern', 'cloud', 'design', 'analyst'];
const DOMAINS = [
  '',
  'Software Development',
  'Data Science',
  'Web Development',
  'Mobile Development',
];

function record(res, name, trend) {
  const passed = check(res, {
    [`${name} returned HTTP 200`]: (r) => r.status === 200,
  });

  if (!passed) {
    const body = String(res.body || '').replace(/\s+/g, ' ').slice(0, 200);
    console.error(`${name} failed: HTTP ${res.status}; response: ${body}`);
  }

  errors.add(!passed);

  if (trend) {
    trend.add(res.timings.duration);
  }
}

export function setup() {
  const login = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({
      email: __ENV.STUDENT_EMAIL || 'student@ipp.demo',
      password: __ENV.STUDENT_PASSWORD || 'Demo@12345',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const loginOk = check(login, {
    'login succeeded': (r) => r.status === 200 && !!r.json('token'),
  });

  if (!loginOk) {
    throw new Error(
      `Login failed with HTTP ${login.status}. Check BASE_URL and student credentials.`
    );
  }

  const token = login.json('token');
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const list = http.get(`${BASE}/listings?limit=20`, auth);

  const listOk = check(list, {
    'initial listing request succeeded': (r) => r.status === 200,
  });

  if (!listOk) {
    const body = String(list.body || '').replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(
      `Initial listing request failed: HTTP ${list.status}; response: ${body}`
    );
  }

  const body = list.json();
  const items = Array.isArray(body.items) ? body.items : [];

  return {
    token,
    ids: items.map((item) => item.id).filter(Boolean),
  };
}

export default function (data) {
  const auth = {
    headers: { Authorization: `Bearer ${data.token}` },
  };

  group('browse and search', () => {
    const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];

    const url =
      `${BASE}/listings?q=${encodeURIComponent(q)}` +
      `&domain=${encodeURIComponent(domain)}&page=1&limit=9`;

    record(http.get(url, auth), 'listing search', searchTime);
  });

  sleep(0.2);

  group('listing details', () => {
    if (data.ids.length > 0) {
      const index = Math.floor(Math.random() * data.ids.length);

      record(
        http.get(`${BASE}/listings/${data.ids[index]}`, auth),
        'listing detail',
        detailTime
      );
    }
  });

  sleep(0.2);

  group('student dashboard', () => {
    record(
      http.get(`${BASE}/dashboard/student`, auth),
      'student dashboard',
      dashboardTime
    );

    record(
      http.get(`${BASE}/applications/mine`, auth),
      'my applications',
      applicationsTime
    );

    record(
      http.get(`${BASE}/tests`, auth),
      'assessment list',
      testsTime
    );
  });

  // Avoid creating applications or starting/submitting assessments during load tests.
  sleep(0.5);
}
