# Final Unit Testing Report

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Execution date:** 9 November 2026  
**Execution environment:** Local development environment on the project contributor's MacBook Air  
**Backend command:** `cd server && npm test`  
**Frontend command:** `cd client && npm test`

## 1. Objective

Verify the behaviour of the backend modules independently and at their API/service boundaries using the automated Node.js test suite.

## 2. Test setup and execution

The server package uses Node's built-in test runner with the repository's test setup:

```bash
cd server
npm test
```

The command invokes:

```bash
node --require ./tests/setup.js --test --test-concurrency=1 "tests/**/*.test.js"
```

The test output shows API and service tests, including request-level checks using the project's test setup. The exact dependency versions and runtime version were not recorded in the supplied terminal capture.

## 3. Execution summary

### Backend

| Measure | Observed result |
|---|---:|
| Test cases | 236 |
| Test suites | 66 |
| Passed | 236 |
| Failed | 0 |
| Cancelled | 0 |
| Skipped | 0 |
| Todo | 0 |
| Duration | 80.66 seconds |

**Result: PASS** — all 236 tests reported by the captured `npm test` execution passed.

### Frontend
| Measure | Observed result |
|---|---:|
| Test files | 15 passed |
| Test cases | 56 passed |
| Failed | 0 |
| Duration | 8.24 seconds |
| Runner | Vitest 5.0.5 |

**Result: PASS** — all 56 frontend component/unit tests reported by the captured `npm test` execution passed.

The frontend suite includes tests for authentication context, resume application, internship search, aptitude tests, test runner and results, application details, analytics, route guards, and student/recruiter/admin dashboards.

## 4. Functional areas represented in the backend automated suite

The terminal output includes passing tests for:

- Registration, email OTP, login, JWT, refresh, logout, password reset and account lockout.
- Role-based access control, recruiter approval and listing approval.
- Listing creation, ownership, search, filtering, sorting and expiry.
- Resume upload and application submission, duplicate prevention, PDF validation, size limits and scanning.
- Application status transitions, applicant access, audit trails and notifications.
- Interview scheduling.
- Test/question-bank workflows, auto-save, MCQ scoring, timers, auto-submit and reattempt controls.
- Student dashboards, placement analytics, CSV/PDF exports and audit-log viewing.
- Rate limiting, error handling, HTTPS/TLS enforcement and uptime monitoring.
- Resume storage encryption and scoring-service integration/fallback.

These are the test areas shown in the captured test output; this list does not claim that every possible user journey was manually exercised.

## 5. Evidence

The captured terminal outputs are included at:

- `docs/testing-evidence/backend-unit-test-output.txt`
- `docs/testing-evidence/frontend-unit-test-output.txt`

The final summary lines in that log report `tests 236`, `suites 66`, `pass 236`, `fail 0`, and `skipped 0`.

## 6. Frontend test warnings

The frontend run passed all 56 tests but printed React `act(...)` warnings for state updates in the Internships page tests. Vitest also printed a jsdom environment performance advisory. Neither was reported as a test failure. The warnings are worth cleaning up, but do not change the observed pass count.

## 7. Limitations

- This report records the backend automated test execution only.
- It does not establish completion of manual user acceptance testing or full browser-based end-to-end testing.
- The terminal capture does not include a commit hash, exact Node.js/npm versions, or a named tester identity.

## 8. Conclusion

The captured automated test runs completed successfully: 236 backend tests across 66 suites and 56 frontend tests across 15 test files, with zero reported failures in either run. These automated tests do not replace manual end-to-end testing or formal user acceptance testing.
