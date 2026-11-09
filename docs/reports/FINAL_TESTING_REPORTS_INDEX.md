# Final Testing Reports — Index

**Project:** Online Internship & Placement Preparation Portal (IPP)  
**Evidence date:** 9 November 2026

This folder contains the final reports prepared from the supplied terminal evidence. The raw terminal captures used to prepare the reports are retained in `testing-evidence/`.

## Reports

1. [Final Unit Testing Report](FINAL_UNIT_TESTING_REPORT.md)
2. [Final System Testing Report](FINAL_SYSTEM_TESTING_REPORT.md)
3. [Final Validation Testing Report](FINAL_VALIDATION_TESTING_REPORT.md)
4. [Final Code Coverage and Branch Coverage Report](FINAL_CODE_AND_BRANCH_COVERAGE_REPORT.md)

## Evidence files

- `testing-evidence/backend-unit-test-output.txt` — output from `npm test`.
- `testing-evidence/backend-coverage-test-output.txt` — output from `npm run test:coverage`.
- `testing-evidence/frontend-production-build-output.txt` — output from `npm run build`.
- `testing-evidence/frontend-unit-test-output.txt` — output from `npm test`.

## Important status note

The backend automated tests, frontend component/unit tests (56/56), and frontend production build passed in the captured run. The system testing report is marked partially verified because the supplied evidence does not include a complete manual browser-based end-to-end test or formal user acceptance test. Existing acceptance-test cases marked `Not Run` or `In Progress` must not be changed to `Passed` without additional evidence.
