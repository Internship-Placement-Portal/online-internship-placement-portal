# Final Code Coverage and Branch Coverage Report

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Execution date:** 9 November 2026  
**Tool:** c8  
**Command:** `cd server && npm run test:coverage`

## 1. Objective

Measure backend statement, branch, function and line coverage while executing the automated backend test suite, and record the configured coverage-gate checks.

## 2. Coverage execution

The server package defines `test:coverage` to run the Node test suite under c8 and then execute a separate core-module coverage check. The core check applies minimum thresholds of 40% for lines, functions and branches to the configured authentication, application, notification, test, attempt, scoring, question, storage, scanning and resume-validation source files.

The supplied terminal capture shows the coverage-enabled test run completed with 236 tests passed and 0 failed. It then invokes `npm run coverage:core`; the command returns to the shell prompt without a reported error.

## 3. Overall backend coverage results

| Coverage metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Statements | 4,082 | 4,242 | 96.22% |
| Branches | 1,083 | 1,199 | 90.32% |
| Functions | 236 | 246 | 95.93% |
| Lines | 4,082 | 4,242 | 96.22% |

## 4. Interpretation

- **Statement coverage (96.22%)**: 4,082 of 4,242 measured statements were executed by the test run.
- **Branch coverage (90.32%)**: 1,083 of 1,199 measured branch outcomes were executed. Branch coverage is lower than statement coverage, indicating some conditional paths remain unexercised.
- **Function coverage (95.93%)**: 236 of 246 measured functions were called.
- **Line coverage (96.22%)**: 4,082 of 4,242 measured lines were executed.

Coverage is a measure of which code paths were executed; it does not by itself prove that every behaviour is correct or that all requirements are satisfied.

## 5. Coverage gate

The `test:coverage` script configures minimum thresholds of 40% for lines, functions and branches for the overall run. It then invokes `coverage:core`, which applies the same minimum thresholds to the listed core-module file patterns.

The supplied output reaches the end of `coverage:core` and returns to the shell prompt without an error. This is evidence that the configured command completed successfully in that run.

## 6. Evidence

The complete coverage-enabled terminal output, including the coverage summary and core coverage command, is stored at:

`docs/reports/testing-evidence/backend-coverage-test-output.txt`

## 7. Scope and limitations

- These coverage figures apply to the backend source measured by the c8 configuration; they are not frontend coverage figures.
- The frontend production build succeeded, but no frontend coverage run was supplied.
- The report does not infer coverage for files excluded by the c8 configuration.
- Coverage percentages do not replace functional, security, system or user acceptance testing.

## 8. Conclusion

The backend coverage run recorded 96.22% statement coverage, 90.32% branch coverage, 95.93% function coverage and 96.22% line coverage. The configured overall and core-module coverage checks completed without a reported error in the supplied terminal capture.
