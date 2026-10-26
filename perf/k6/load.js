
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:5000/api';
const PEAK = Number(__ENV.PEAK_VUS || 10);
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
    http_req_duration: ['p(90)<3000'],
    listing_search_duration: ['p(90)<2000'],
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
  errors.add(!passed);
  if (trend) trend.add(res.timings.duration);
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

  check(list, {
    'initial listing request succeeded': (r) => r.status === 200,
  });

  const body = list.status === 200 ? list.json() : {};
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

  // Deliberately do not create applications or start/submit assessments.
  sleep(0.5);
}
