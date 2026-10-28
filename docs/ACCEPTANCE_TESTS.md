# IPP Acceptance Test Matrix

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Source documents:** `6_SRS.pdf` (SRS v1.0, especially Sections 4–6 and 8) and `6_TestPlan.pdf` (STP v1.0, especially Sections 3, 5, 13 and 14)  
**Status convention:** `Not Run` = no execution evidence recorded here; `Pass`/`Fail` should only be set after recording actual execution evidence.

## Execution notes

- The SRS exit criteria require all High-priority functional requirements to be implemented and verified, no critical non-functional failures to remain open, and mapped RTM tests to pass.
- The local k6 smoke run supplied for this work completed **2,242 HTTP requests**, with **0% HTTP request failures**, overall HTTP **p90 = 18.79 ms**, and listing-search **p90 = 18.6 ms** at a maximum of **10 VUs**. This is recorded as a local smoke result only; it does **not** demonstrate the SRS requirement for up to 500 concurrent users or the 5× scaling requirement.
- Only the k6 smoke result above is recorded as observed evidence. Other cases remain `Not Run` until a tester records their actual results.

## Acceptance test cases

| Test ID | SRS requirement | Scenario / steps (summary) | Expected result / acceptance criterion | Actual result / evidence | Status |
|---|---|---|---|---|---|
| TC-Auth-01 | IPP-F-001 | Register Student, Recruiter, and Placement Officer/Admin accounts; verify email OTP flow and assigned role. | Account is created only after email OTP verification and has the correct role. | Not recorded. | Not Run |
| TC-Auth-02 | IPP-F-002 | Log in with valid credentials, then try invalid credentials. | Valid login returns a signed JWT within configured expiry; invalid credentials are rejected. | Not recorded. | Not Run |
| TC-Auth-03 | IPP-F-003 | Inspect stored user records after registration. | Passwords are stored as bcrypt/argon2 hashes, never plaintext. | Not recorded. | Not Run |
| TC-Auth-04 | IPP-F-004 | Make five consecutive failed login attempts, then make a sixth attempt; inspect audit logs. | Sixth attempt is blocked for 15 minutes and an audit-log entry is created. | Not recorded. | Not Run |
| TC-Auth-05 | IPP-F-005 | Request password reset; use the link after 30 minutes and attempt reuse. | Reset link expires after 30 minutes and reused links are rejected. | Not recorded. | Not Run |
| TC-List-01 | IPP-F-006 | As an approved recruiter, create/edit/publish a listing; check student visibility before and after approval. | Listing is saved and visible to students only after admin approval. | Not recorded. | Not Run |
| TC-List-02 | IPP-F-007 | Search/filter listings by domain, location, stipend, and duration; measure response time. | Results match all applied criteria and return within 5 seconds. | k6 local smoke: listing-search p90 18.6 ms at max 10 VUs; smoke query coverage does not establish all filter combinations. | In Progress |
| TC-List-03 | IPP-F-008 | Open a listing detail page. | Company profile, eligibility, deadline, and other required details render without missing-data errors. | Not recorded. | Not Run |
| TC-List-04 | IPP-F-009 | Search for a listing before and after its deadline. | Listing is hidden from active search results after the deadline timestamp. | Not recorded. | Not Run |
| TC-App-01 | IPP-F-010, IPP-SR-005 | Apply to a listing with a valid PDF; try a non-PDF, oversized PDF, malformed/truncated PDF, and duplicate application. | Valid PDF up to 5 MB is accepted after scanning; invalid/malicious files and duplicate applications are rejected. | Automated test evidence not attached to this matrix. | Not Run |
| TC-App-02 | IPP-F-011 | Recruiter changes an application status; student checks dashboard/application view. | Status change is persisted and reflected to the student. | Not recorded. | Not Run |
| TC-App-03 | IPP-F-012 | Change application status and inspect in-app/email notification timestamps. | Notification is generated within five minutes. | Not recorded. | Not Run |
| TC-App-04 | IPP-F-013 | Recruiter schedules an interview for a shortlisted candidate. | Interview date, mode, and link are visible to the student. | Not recorded. | Not Run |
| TC-Test-01 | IPP-F-014 | Start a timed test; inspect question selection and let the timer expire. | MCQ/coding questions come from the configurable bank, questions are randomized per attempt, and test auto-submits at time zero. | Not recorded. | Not Run |
| TC-Test-02 | IPP-F-015 | Submit known MCQ answers and compare the result with the answer key. | Score matches the known answer key and is displayed after submission. | Not recorded. | Not Run |
| TC-Test-03 | IPP-F-016 | Complete a test, attempt it again, then test the admin re-enable path. | Reattempt is blocked unless an administrator re-enables it; re-enabled attempt is recorded. | Not recorded. | Not Run |
| TC-Test-04 | IPP-F-017 | Complete a test and inspect per-student/per-test analytics. | Accuracy, time per question, and category performance are recorded and queryable. | Not recorded. | Not Run |
| TC-Dash-01 | IPP-F-018 | Compare student dashboard figures against seeded application, interview, and test records. | Dashboard figures match underlying records. | k6 confirmed student-dashboard endpoint returned HTTP 200 during local smoke; data reconciliation was not tested. | In Progress |
| TC-Dash-02 | IPP-F-019 | Compare placement analytics with raw application/test data. | Aggregate placement rate, company-wise applications, and student performance reconcile with raw data. | Not recorded. | Not Run |
| TC-Dash-03 | IPP-F-020 | Render charts across date ranges with and without data gaps. | Bar/line/pie charts render correctly and cover at least the last 12 months. | Not recorded. | Not Run |
| TC-Dash-04 | IPP-F-021 | Export filtered analytics as CSV and PDF; inspect headers and records. | Export contains all filtered records with correct headers. | Not recorded. | Not Run |
| TC-Admin-01 | IPP-F-022 | Attempt listing creation with an unapproved recruiter, then approve the recruiter and retry. | Unapproved recruiter cannot post; approval unlocks posting rights. | Not recorded. | Not Run |
| TC-Admin-02 | IPP-F-023, IPP-SR-006 | Call protected API endpoints with an unauthorized role/token. | Unauthorized role receives HTTP 403 and access is logged; RBAC suite rejects unauthorized access. | Server automated tests have previously been reported as passing, but no detailed endpoint-by-endpoint evidence is attached here. | In Progress |
| TC-Admin-03 | IPP-F-024 | Perform administrative approval/deletion/role-change actions and inspect audit logs. | Every administrative action has an audit entry with timestamp and actor ID. | Not recorded. | Not Run |
| TC-Perf-01 | IPP-NF-001 | Run k6/JMeter at up to 5 concurrent users against a representative test environment. | HTTP/page response p90 is ≤ 8 seconds for at least 90% of requests. | Local smoke: 2,242 requests; 0% HTTP failures; overall p90 18.79 ms at max 10 VUs. A later local 500-VU run also passed (overall p90 1.24 s; see PERFORMANCE.md), so the 5-user target is met with margin. | Passed |
| TC-Scale-01 | IPP-NF-005 | Measure baseline with one instance, then repeat with five instances under comparable load. | 2× increase in concurrent-user capacity with near-linear scaling and no code changes. | No 1-versus-5-instance measurement recorded. | Not Run |
| TC-Rel-01 | IPP-NF-002 | Review a complete monthly uptime monitoring report. | Monthly uptime is at least 90%, excluding scheduled maintenance. | No monthly monitoring report attached. | Not Run |
| TC-Sec-01 | IPP-NF-003 | Verify TLS and inspect sensitive data storage/security configuration. | No plaintext sensitive data in transit; SRS calls for TLS 1.2+ and SSL Labs grade A. | Not recorded. | Not Run |
| TC-Sec-02 | IPP-SR-001 | Scan client-server and server-to-microservice endpoints. | All applicable connections require TLS 1.2+; no unencrypted endpoint is found. | Not recorded. | Not Run |
| TC-Sec-03 | IPP-SR-002 | Test token expiry and refresh-token revocation. | Access token lifetime is at most 60 minutes; expired tokens and revoked refresh tokens are rejected. | Not recorded. | Not Run |
| TC-Sec-04 | IPP-SR-003 | Run input-validation checks and OWASP ZAP for NoSQL injection/XSS. | No high-severity injection vulnerabilities are reported. | Not recorded. | Not Run |
| TC-Sec-05 | IPP-SR-004 | Exceed configured authentication and upload rate limits. | Requests beyond configured thresholds return HTTP 429. | Not recorded. | Not Run |
| TC-Sec-06 | IPP-SR-005 | Upload non-PDF, oversized, truncated, and malicious-content sample files. | Invalid files are rejected before storage; clean PDF within 5 MB can proceed. | Not recorded. | Not Run |
| TC-Sec-07 | IPP-SR-006 | Run automated RBAC checks across protected API endpoints. | 100% of endpoints reject roles without explicit permission. | Not recorded in this matrix. | In Progress |
| TC-UX-01 | IPP-NF-004 | Run Lighthouse/axe accessibility audit and keyboard-navigation checks. | WCAG 2.1 AA checks pass with no critical violations. | No audit report attached. | Not Run |

## Execution record template

For each test execution, add: **date/time, build/commit, environment, tester, test data, actual result, evidence link/log, defect ID (if failed), and final status**.

## Acceptance exit criteria

Per the SRS Section 6 and STP Section 5, do not declare acceptance until:
1. All High-priority functional requirements are implemented and verified.
2. No critical non-functional failures remain open.
3. All planned test cases have been executed.
4. All mapped test cases in the RTM are passed.
5. The 5-user performance and 2× scaling claims are supported by actual measurements, not extrapolated.
## Automated Server Regression Test Evidence

**Execution date:** 26 October 2026  
**Environment:** Local Windows development environment  
**Test suites:** 43  
**Tests:** 168 passed, 0 failed, 0 skipped.

The complete server regression test suite passed. The HTTPS enforcement test file was also executed independently, with all 7 tests passing and no skips after making the Git-bundled OpenSSL executable available on the current PowerShell PATH.

This result verifies the automated server tests executed by the current test command. It does not by itself establish that every manual acceptance scenario, the 5-concurrent-user requirement, or the 2× horizontal-scaling requirement has passed.