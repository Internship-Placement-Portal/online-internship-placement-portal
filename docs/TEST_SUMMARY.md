# Test Summary Report

Covers the Test Plan deliverables (§8): test cases, scripts, data, execution log, defects, summary.

## Results
| Suite | Tool | Result |
|---|---|---|
| API / integration / RBAC (`server/tests`) | Node test runner + supertest + in-memory MongoDB | 156 passed, 0 failed |
| Python scoring service (`scoring-service/tests`) | pytest | 4 passed, 0 failed |
| Coverage gate | c8 | ≥ 40 % lines/functions/branches overall and on auth, applications, tests, scoring, uploads (enforced in CI) |
| Accessibility | axe | 0 violations, Light and Dark themes |
| Performance (`perf/bench.js`) | custom benchmark | p90 < 8 s up to ~50 concurrent users over a remote Atlas link |

Executed automatically on every push and pull request by GitHub Actions (`.github/workflows/ci.yml`: server tests + coverage,
client build, Python scoring service). Test data: seeded student, recruiter and admin accounts, sample listings, and a seeded question
bank (`server/src/scripts`).

## Exit criteria (Test Plan §5)
- Planned automated cases executed: yes. Critical defects open: none known. All High-priority functional requirements (IPP-F-001…024) map to a passing test (see `RTM.md`).

## Not verified (deployment is out of scope; manual work or local-only)
- IPP-NF-001 / NF-005 at 5 concurrent users and the 2× scaling test: k6 script is in `perf/k6` but has not been run.
- IPP-NF-002 uptime (90 %): checked only over the local demo period; the project is not deployed.
- IPP-SR-001 network TLS scan, IPP-SR-003 OWASP ZAP scan.
- IPP-NF-004 manual screen-reader pass.
- Cypress/Selenium end-to-end UI tests and formal UAT with real users were not performed.

## Defects
No open defects at the time of writing; defects found during development were fixed in the milestone branches (see git history).
