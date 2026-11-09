# Test Summary Report

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Latest execution evidence:** 9 November 2026  
**Evidence location:** `docs/reports/testing-evidence/`

## Latest recorded results

| Activity | Command / tool | Observed result | Status |
|---|---|---|---|
| Backend automated test suite | `cd server && npm test` | 236 tests passed, 0 failed; 66 suites; 0 skipped; 80.66 seconds | PASS |
| Backend test suite with coverage | `cd server && npm run test:coverage` | 236 tests passed, 0 failed; coverage summary below; configured core coverage check returned to prompt without a reported error | PASS |
| Backend statement coverage | c8 | 96.22% (4,082 / 4,242) | Recorded |
| Backend branch coverage | c8 | 90.32% (1,083 / 1,199) | Recorded |
| Backend function coverage | c8 | 95.93% (236 / 246) | Recorded |
| Backend line coverage | c8 | 96.22% (4,082 / 4,242) | Recorded |
| Frontend automated component/unit tests | `cd client && npm test` | 15 test files passed; 56 tests passed; 0 failed; 8.24 seconds | PASS |
| Frontend production build | `cd client && npm run build` | Vite 8.3.3; 1,678 modules transformed; build completed in 521 ms | PASS |

## Evidence files

- `testing-evidence/backend-unit-test-output.txt`
- `testing-evidence/backend-coverage-test-output.txt`
- `testing-evidence/frontend-production-build-output.txt`
- `testing-evidence/frontend-unit-test-output.txt`

## Interpretation and scope

The backend automated suite includes API/service tests for authentication, authorization, listings, applications, resume uploads and validation, notifications, interviews, assessments, dashboards, analytics, exports, security controls and uptime monitoring.

The c8 percentages are backend coverage figures for the source files included by the repository's c8 configuration. They are not frontend coverage figures. The configured coverage script specifies minimum 40% line/function/branch thresholds for the overall run and for selected core-module file patterns.

The frontend component/unit suite passed 56/56 tests. Its output included React `act(...)` warnings in Internships page tests and a jsdom performance advisory; neither was reported as a test failure. The frontend build verifies production compilation. Neither the component tests nor the build establishes that every browser workflow has passed.

## Not established by the supplied 9 November evidence

- A fresh Python scoring-service pytest run.
- Complete manual browser-based end-to-end testing across student, recruiter and administrator roles.
- Formal user acceptance testing.
- Production deployment smoke testing, external penetration testing, or a fresh OWASP ZAP scan.

These activities must remain Not Run / Not Verified until separate evidence is collected.

## Historical count discrepancy

Earlier repository documentation records 156 backend tests and 168 backend tests in separate historical summaries. Those figures are not the latest execution evidence. The supplied 9 November terminal captures report 236 tests passed in both the ordinary backend test run and the coverage-enabled run. Use the 9 November logs as the latest recorded result, and retain the historical figures only when discussing their original execution dates.

## Conclusion

The latest supplied evidence confirms that 236 backend tests and 56 frontend tests passed (292 automated tests combined), the configured backend coverage run completed with the reported coverage values, and the frontend production build succeeded. Overall project acceptance should not be declared solely from these results while manual end-to-end and user acceptance activities remain unverified.
