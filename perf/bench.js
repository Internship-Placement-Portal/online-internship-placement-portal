#!/usr/bin/env node
// Dependency-free load check (Node 18+). Not a replacement for the k6 scenario in perf/k6, but it runs anywhere
// and prints the same numbers NF-001 cares about (p90 latency, error rate).
//
//   node perf/bench.js --url http://localhost:5000 --concurrency 50 --requests 1500
//   Env: BENCH_EMAIL / BENCH_PASSWORD (default student@ipp.demo / Demo@12345)
//
// Raise RATE_LIMIT_API_MAX on the server under test, otherwise the per-IP limiter (SR-004) will answer 429.
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []));
const BASE = args.url || 'http://localhost:5000';
const CONCURRENCY = Number(args.concurrency || 50);
const TOTAL = Number(args.requests || 1000);

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.BENCH_EMAIL || 'student@ipp.demo', password: process.env.BENCH_PASSWORD || 'Demo@12345' }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status}`);
  const { token } = await login.json();
  const headers = { authorization: `Bearer ${token}` };
  const list = await (await fetch(`${BASE}/api/listings?limit=20`, { headers })).json();
  const ids = list.items.map((l) => l.id);

  const targets = [
    () => `/api/listings?q=${['python', 'react', 'intern', 'cloud', ''][Math.floor(Math.random() * 5)]}&limit=9`,
    () => `/api/listings/${ids[Math.floor(Math.random() * ids.length)]}`,
    () => '/api/dashboard/student',
    () => '/api/applications/mine',
    () => '/api/tests',
  ];

  const durations = [];
  const statuses = {};
  let next = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < TOTAL) {
        const i = next++;
        const t0 = performance.now();
        try {
          const res = await fetch(BASE + targets[i % targets.length](), { headers });
          await res.arrayBuffer();
          statuses[res.status] = (statuses[res.status] || 0) + 1;
        } catch {
          statuses.error = (statuses.error || 0) + 1;
        }
        durations.push(performance.now() - t0);
      }
    })
  );
  const secs = (Date.now() - started) / 1000;
  durations.sort((a, b) => a - b);
  const failed = Object.entries(statuses).filter(([s]) => s !== '200').reduce((n, [, c]) => n + c, 0);
  const p90 = pct(durations, 90);
  console.log(JSON.stringify({
    target: BASE,
    concurrency: CONCURRENCY,
    requests: TOTAL,
    seconds: Number(secs.toFixed(1)),
    rps: Math.round(TOTAL / secs),
    ms: { p50: Math.round(pct(durations, 50)), p90: Math.round(p90), p99: Math.round(pct(durations, 99)), max: Math.round(durations[durations.length - 1]) },
    statuses,
    errorRate: Number((failed / TOTAL).toFixed(4)),
    meetsNF001: p90 <= 8000 && failed / TOTAL < 0.01,
  }, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
