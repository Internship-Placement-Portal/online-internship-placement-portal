# IPP Defect Verification Notes

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Source documents:** `6_SRS.pdf` and `6_TestPlan.pdf`  
**Purpose:** Record reproducible defects, fixes, retest evidence, and closure decisions.

## Verification rules

- A defect is `Verified / Closed` only after the original reproduction steps no longer reproduce the problem and regression checks pass.
- If a fix has been applied but there is no reproducible retest evidence, use `Pending Verification`.
- Do not create fictional defect IDs, dates, screenshots, or outcomes. Link each record to its GitHub issue/PR, test log, and commit when available.
- The STP requires defect reports, test execution logs, daily status, and a final test summary report.

## Defect log

| Defect ID | Related requirement / test | Description and impact | Reproduction steps | Fix / change | Retest evidence | Status |
|---|---|---|---|---|---|---|
| DEF-001 (local test-runner issue; map to tracker ID if one exists) | Regression / server automated tests | A server test failure was associated with the storage-service test assertion approach. This blocked reliable CI verification. | Run the server test suite using the repository's documented test command and observe the prior assertion failure. Preserve the exact original log/issue link if available. | Test was updated to use Node's built-in `assert` in `server/tests/storageService.test.js`; change was submitted in PR #52 (`fix: use Node assert in storage service tests`). | Previously reported run: 166 tests passed, 0 failed, 2 skipped. Re-run on the current merged `main` commit and attach CI/run output before final closure. | Pending Verification |
| DEF-TEMPLATE-01 | Any failing acceptance test | Template row for a future defect. Replace this row with an actual defect record only when a failure is observed. | Record exact environment, account/role, data, endpoint/page, steps, and expected versus actual result. | Record the linked fix PR/commit and change summary. | Attach retest run, screenshot/log, build commit, tester, and date. Include a regression check. | Not Opened — template only |

## Retest checklist

For each actual defect:
1. Confirm the fix is present in the tested commit/build.
2. Repeat the original steps with the same preconditions and data.
3. Confirm the observed result matches the expected result.
4. Run relevant regression tests for the affected module.
5. Record the command or manual steps, test output, date, tester, and evidence link.
6. Close only when the evidence supports closure; otherwise keep `Pending Verification` or `Open`.

## Suggested defect report fields

- Defect ID and short title
- Date found / reporter
- Environment and build/commit
- Related SRS requirement and test case ID
- Preconditions and test data (exclude secrets and personal data)
- Steps to reproduce
- Expected result
- Actual result
- Severity and priority
- Evidence (logs/screenshots/CI run)
- Fix PR/commit
- Retest steps and result
- Regression test result
- Status and verifier/date

## Current limitations

No complete defect tracker export, original failure log for every issue, or retest evidence for all defects was supplied with the SRS/Test Plan. Therefore this document records only the previously discussed server test-runner issue and provides a template for additional observed defects. Update statuses from actual GitHub Issues/PRs and CI results.
