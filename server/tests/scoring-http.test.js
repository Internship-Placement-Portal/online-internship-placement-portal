const { describe, it, before, after, beforeEach } = require('node:test');
const http = require('http');
const expect = require('./expect');
const Question = require('../src/models/Question');
const config = require('../src/config/env');
const scoringService = require('../src/services/scoringService');
const { startDb, stopDb, clearDb } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

// IPP-SR / SRS 2.5: the optional Python scoring service, with graceful fallback to the Node scorer.
function stub(handler) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => handler(req, res, JSON.parse(raw || '{}')));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

describe('httpScorer', () => {
  const saved = { ...config.scoring };
  let q;
  beforeEach(async () => {
    q = await Question.create({ text: 'Two plus two equals?', type: 'mcq', options: ['3', '4', '5', '6'], correctIndex: 1, category: 'Quant', marks: 2 });
  });
  after(() => Object.assign(config.scoring, saved));
  const payload = () => ({ answers: [{ questionId: String(q._id), selectedIndex: 1 }] });

  it('posts answers + key to the service and returns its result', async () => {
    let seen;
    const s = await stub((req, res, body) => {
      seen = { url: req.url, token: req.headers['x-internal-token'], body };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ score: 99, maxScore: 99 }));
    });
    Object.assign(config.scoring, { url: `http://127.0.0.1:${s.address().port}`, token: 'tok', timeoutMs: 2000 });
    const out = await scoringService.httpScorer(payload());
    s.close();
    expect(out.score).toBe(99);
    expect(seen.url).toBe('/internal/analytics/score-test');
    expect(seen.token).toBe('tok');
    expect(seen.body.questions[0].correctIndex).toBe(1);
  });

  it('falls back to the Node scorer when the service is down or errors', async () => {
    Object.assign(config.scoring, { url: 'http://127.0.0.1:1', token: '', timeoutMs: 500 });
    expect((await scoringService.httpScorer(payload())).score).toBe(2);
    const s = await stub((req, res) => { res.statusCode = 500; res.end('{}'); });
    config.scoring.url = `http://127.0.0.1:${s.address().port}`;
    expect((await scoringService.httpScorer(payload())).score).toBe(2);
    s.close();
  });

  it('maps a 422 from the service to UNKNOWN_QUESTION', async () => {
    const s = await stub((req, res) => { res.statusCode = 422; res.end('{}'); });
    Object.assign(config.scoring, { url: `http://127.0.0.1:${s.address().port}`, timeoutMs: 2000 });
    let err;
    try { await scoringService.httpScorer(payload()); } catch (e) { err = e; }
    s.close();
    expect(err.status || err.statusCode).toBe(422);
  });
});
