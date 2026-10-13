# Requirements Traceability Matrix (SRS §8, Test Plan §13)

Status: **A** = accepted/passed (automated test green in CI), **P** = partial / needs a deployed environment.
Automated tests live in `server/tests/` (Node test runner, 156 tests), `scoring-service/tests/` (pytest, 4 tests), and `perf/`.

| Req | Requirement | Module | Verified by | Status |
|---|---|---|---|---|
| IPP-F-001 | Role-based registration + email OTP | AuthModule | auth.test.js "registration + email OTP" | A |
| IPP-F-002 | Login, signed JWT | AuthModule | auth.test.js "login + JWT" | A |
| IPP-F-003 | bcrypt password hashing | AuthModule | auth.test.js "registration + email OTP" | A |
| IPP-F-004 | 15-min lockout after 5 failures, audit-logged | AuthModule | auth.test.js "account lockout" | A |
| IPP-F-005 | Password reset link, 30 min, single use | AuthModule | password-reset.test.js | A |
| IPP-F-006 | Recruiter listings, admin approval | ListingModule | listings.test.js CRUD; admin.test.js listing approval | A |
| IPP-F-007 | Search/filter, paginated | ListingModule | listings.test.js "search, filter, pagination" | A |
| IPP-F-008 | Listing detail / company profile | ListingModule | listings.test.js; admin.test.js profile | A |
| IPP-F-009 | Auto-hide after deadline | ListingModule | listings.test.js "expired listings are hidden" | A |
| IPP-F-010 | Resume upload (PDF ≤ 5 MB) + apply, no duplicates | ApplicationModule | applications.test.js "apply with resume" | A |
| IPP-F-011 | Recruiter updates status | ApplicationModule | applications.test.js "status management" | A |
| IPP-F-012 | Email + in-app notification | ApplicationModule | applications.test.js "status management + notifications" | A |
| IPP-F-013 | Interview scheduling | ApplicationModule | applications.test.js "interview scheduling" | A |
| IPP-F-014 | Timed tests, randomised, auto-save, auto-submit | TestModule | tests-engine.test.js (engine, auto-save, timer); question-bank.test.js | A |
| IPP-F-015 | Auto-evaluate MCQs | TestModule + Python scoring service | tests-engine.test.js "MCQ auto-scoring"; scoring-http.test.js; scoring-service/tests | A |
| IPP-F-016 | One attempt, admin override | TestModule | tests-engine.test.js "reattempt block" | A |
| IPP-F-017 | Per-attempt analytics | AnalyticsModule | tests-engine.test.js "analytics per student and per test" | A |
| IPP-F-018 | Student dashboard | DashboardModule | dashboard.test.js "student dashboard" | A |
| IPP-F-019 | Placement analytics | DashboardModule | dashboard.test.js "placement analytics" | A |
| IPP-F-020 | Charts, last 12 months | DashboardModule | dashboard.test.js (data); UI charts | A |
| IPP-F-021 | CSV/PDF export | DashboardModule | dashboard.test.js "export" | A |
| IPP-F-022 | Recruiter/listing approval | AdminModule | admin.test.js "recruiter approval" | A |
| IPP-F-023 | RBAC on every route, 403 logged | Security layer | rbac-matrix.test.js; auth.test.js "RBAC" | A |
| IPP-F-024 | Admin audit log | AdminModule | dashboard.test.js "audit log viewer" | A |
| IPP-NF-001 | p90 ≤ 3 s | WebUI / API | perf/bench.js (p90 < 3 s up to ~50 users, remote Atlas); perf/k6 script written | P — 500-user k6 run needs staging |
| IPP-NF-002 | 99.5 % monthly uptime | Ops | needs monitoring on a deployed system | P |
| IPP-NF-003 | TLS 1.2+ | Security layer | https-enforcement.test.js | A (code); cert setup per docs/SECURITY.md |
| IPP-NF-004 | WCAG 2.1 AA | WebUI | docs/ACCESSIBILITY.md; axe 0 violations (light + dark) | P — manual screen-reader pass pending |
| IPP-NF-005 | Scalability / stateless API | API | stateless design; perf scripts | P — 5× scaling test needs staging |
| IPP-NF-006 | Modular, ≥ 70 % coverage | All | CI `npm run test:coverage` enforces ≥ 70 % overall and on core modules | A |
| IPP-SR-001 | TLS | Security layer | https-enforcement.test.js; network scan needs deployment | P |
| IPP-SR-002 | JWT ≤ 60 min, revocable refresh | AuthModule | auth.test.js "login + JWT", "refresh + logout" | A |
| IPP-SR-003 | Validation, NoSQL-injection/XSS sanitisation | Security layer | validators + auth/listing tests; OWASP ZAP scan not run | P |
| IPP-SR-004 | Rate limit auth + uploads | Security layer | auth.test.js "rate limiting"; upload-ratelimit.test.js | A |
| IPP-SR-005 | PDF-only, 5 MB, content scan | Security layer | applications.test.js "resume validation and scanning"; scan.test.js | A |
| IPP-SR-006 | RBAC across all endpoints | Security layer | rbac-matrix.test.js | A |
