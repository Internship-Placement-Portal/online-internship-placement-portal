# Final Validation Testing Report

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Execution date:** 9 November 2026

## 1. Objective

Document automated evidence that the application validates user input, request state, access permissions and uploaded resume files according to the behaviours represented in the backend test suite.

## 2. Validation areas evidenced by automated tests

| Validation area | Evidence visible in captured test output | Result |
|---|---|---|
| Registration and account input | Invalid registration input and prohibited admin-role registration are rejected | PASS |
| Duplicate account registration | Duplicate email returns conflict response | PASS |
| Authentication and OTP | Login is blocked before OTP verification; excessive OTP guessing is locked | PASS |
| Listing input | Required fields, deadlines, domains and negative stipend values are validated | PASS |
| Search filters | Invalid min/max stipend and duration ranges are rejected | PASS |
| Application status | Invalid status transitions and no-op changes are rejected | PASS |
| Resume type and content | Non-PDF extension, incorrect MIME type, invalid PDF signature and truncated PDF are rejected | PASS |
| Resume size | Files over 5 MB are rejected; files within the configured limit are accepted | PASS |
| Resume active content | Embedded JavaScript and other active-content patterns are blocked | PASS |
| Resume filename | Path-traversal-style filename input is sanitized | PASS |
| Authorization | Anonymous and unauthorized roles are denied on protected endpoints | PASS |
| Rate limiting | Login and upload requests exceeding configured thresholds receive rate-limit responses | PASS |
| Test answer validation | Foreign question IDs, invalid indexes and answer/question-type mismatches are rejected | PASS |

## 3. Specific resume-upload validation evidence

The captured tests report successful checks for:

- PDF extension, MIME type and file-presence validation.
- PDF signature (`%PDF-`) and footer (`%%EOF`) checks.
- Maximum file size of 5 MB.
- Active-content indicators such as `/JavaScript`, `/Launch`, `/OpenAction`, `/SubmitForm` and `/EmbeddedFile`.
- Duplicate-application rejection and prevention of unnecessary/orphaned file storage.
- Scanner failure handling that fails closed.

These are automated test results. They do not replace a separate manual upload exercise through the deployed browser UI.

## 4. Execution summary

The validation behaviours above are included in the backend test execution:

| Measure | Observed result |
|---|---:|
| Backend tests passed | 236 |
| Backend tests failed | 0 |
| Test suites | 66 |

The source evidence is included in:

`docs/reports/testing-evidence/backend-unit-test-output.txt`

and

`docs/reports/testing-evidence/backend-coverage-test-output.txt`

## 5. Limitations

- This report is based on automated backend tests, not a separate manual validation session.
- No independent OWASP ZAP scan or external security penetration test is evidenced by the supplied terminal logs.
- No new manual form-by-form browser validation results were supplied.
- The report does not claim that all possible invalid inputs or attack payloads have been tested.

## 6. Conclusion

The captured backend automated tests provide passing evidence for the listed input, file-upload, state-transition and authorization validation cases. Validation testing is therefore supported for these tested cases only; broader manual and security assessment activities remain outside the supplied evidence.
