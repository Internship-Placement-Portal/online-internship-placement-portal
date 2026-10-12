// Automated accessibility audit (IPP-NF-004, TC-UX-01): runs axe-core (WCAG 2.0/2.1 A + AA) against the running app in
// every colour theme and fails (exit 1) on any violation.
//
//   1. start the API and `npm run dev` in client/ (demo data: `npm run seed:demo` in server/)
//   2. cd client && npm run a11y
//
// Env: APP_URL (default http://localhost:5173), BROWSER_PATH (Edge/Chrome executable), DEMO_PASSWORD,
//      ADMIN_EMAIL / ADMIN_PASSWORD (enables the admin pages).
import fs from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const APP = process.env.APP_URL || 'http://localhost:5173';
const DEMO = process.env.DEMO_PASSWORD || 'Demo@12345';
const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found. Set BROWSER_PATH.');

const THEMES = ['light', 'dark', 'contrast'];
const SUITES = [
  { who: 'public', login: null, paths: ['/login', '/register', '/forgot-password'] },
  {
    who: 'student',
    login: ['student@ipp.demo', DEMO],
    paths: ['/student', '/student/internships', '/student/applications', '/student/tests', '/student/profile'],
  },
  { who: 'recruiter', login: ['recruiter@ipp.demo', DEMO], paths: ['/recruiter', '/recruiter/listings', '/recruiter/listings/new', '/recruiter/profile'] },
  ...(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD
    ? [{ who: 'admin', login: [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD], paths: ['/admin', '/admin/approvals', '/admin/questions', '/admin/tests', '/admin/analytics', '/admin/audit'] }]
    : []),
];

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] });
let violations = 0;
let pages = 0;

for (const theme of THEMES) {
  for (const suite of SUITES) {
    // A fresh browser context per suite so one role's session never leaks into the next (login would redirect).
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluateOnNewDocument((t) => localStorage.setItem('ipp-theme', t), theme);
    if (suite.login) {
      await page.goto(`${APP}/login`, { waitUntil: 'networkidle0' });
      await page.type('#email', suite.login[0]);
      await page.type('#password', suite.login[1]);
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), page.click('button[type=submit]')]);
    }
    for (const path of suite.paths) {
      await page.goto(`${APP}${path}`, { waitUntil: 'networkidle0' });
      await new Promise((r) => setTimeout(r, 500));
      await page.evaluate(axeSource);
      const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      pages += 1;
      violations += res.violations.length;
      if (res.violations.length) {
        console.log(`✖ [${theme}] ${suite.who} ${path}`);
        res.violations.forEach((v) => console.log(`   ${v.impact} ${v.id}: ${v.help} — ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(`\nAccessibility audit: ${pages} page views across ${THEMES.length} themes, ${violations} violation(s).`);
process.exit(violations ? 1 : 0);
