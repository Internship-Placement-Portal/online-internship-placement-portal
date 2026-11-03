# Uptime Monitoring and Service Recovery (IPP-NF-002)

## 1. Objective

The Online Internship & Placement Preparation Portal aims to maintain
99.5% monthly service availability, excluding scheduled maintenance.

This document describes the existing uptime monitoring implementation,
downtime recording, failure logging and service recovery procedures.

## 2. Uptime Target

The monthly uptime target is 99.5%.

Formula:

Uptime (%) = ((Total monitored time - Unscheduled downtime)
              / Total monitored time) * 100

Scheduled maintenance is excluded from downtime calculations.

The monthly uptime report:
- Uses the full duration for completed months.
- Uses elapsed time for the current month.
- Excludes scheduled maintenance.
- Merges overlapping downtime intervals to avoid double-counting.
- Identifies whether the 99.5% target was achieved.

## 3. Monitoring Architecture

The application uses an internal uptime monitoring service.

### Components

| Component | Responsibility |
|---|---|
| Downtime model | Stores downtime start, recovery time, duration and reason |
| uptimeService.js | Checks MongoDB connectivity every 30 seconds |
| uptimeReportService.js | Calculates monthly uptime |
| logger | Records connection failures and recovery events |
| /health | Reports API and database health |
| /ready | Reports whether the application is ready to serve requests |
| Admin uptime API | Provides monthly uptime reports |

### Health endpoints

- `/health`: Returns API and database health information.
- `/ready`: Returns HTTP 200 when MongoDB is connected and HTTP 503 otherwise.
- `/api/health`: Existing deployment health-check path configured in Render.

### Monitoring behaviour

1. The monitoring service checks the MongoDB connection state.
2. When MongoDB becomes unavailable, downtime is detected.
3. The failure is recorded in application logs.
4. When MongoDB reconnects, the service records the recovery time and downtime duration.
5. The downtime record is stored in MongoDB.

The monitoring interval is 30 seconds, so detection may be delayed by up to one monitoring interval.

### Important limitation

The internal monitoring service depends on the Node.js process running.

It cannot independently record a complete application-process crash,
hosting outage or outage that occurs while the monitoring process is stopped.

An external monitoring service should periodically check the deployed
application's health endpoint and maintain independent availability records
for production-level verification of the 99.5% target.

External monitoring is not currently configured in this repository.

## 4. Monthly Uptime Report

Administrators can retrieve monthly uptime information through:

GET /api/admin/uptime?year=2026&month=10

The endpoint:
- Requires administrator authentication.
- Validates the requested year and month.
- Returns the uptime percentage.
- Returns recorded downtime in milliseconds.
- Indicates whether the 99.5% target was achieved.

Students, recruiters and unauthenticated users cannot access this endpoint.

## 5. Failure Logging

The application uses the existing logger to record:

- MongoDB disconnection.
- MongoDB reconnection.
- MongoDB connection errors.
- Detected service downtime.
- Successful service recovery.
- Failures while recording downtime.
- Errors during monitoring checks.

Logs should be reviewed when investigating an availability incident.

## 6. Service Recovery Procedure

### Scenario A: MongoDB connection failure

1. Check the API application logs.
2. Verify that MongoDB Atlas or the configured MongoDB instance is available.
3. Verify the MONGODB_URI environment variable.
4. Check MongoDB Atlas Network Access and confirm that the deployed application can connect.
5. Verify the database credentials and connection permissions.
6. Restore MongoDB connectivity.
7. Confirm that the application reconnects.
8. Check the downtime record for its recovery timestamp and duration.
9. Verify that the API health and readiness endpoints respond correctly.

### Scenario B: API application failure

1. Open the Render dashboard.
2. Select the ipp-api service.
3. Inspect deployment and runtime logs.
4. Identify the startup error or application failure.
5. Verify environment variables and database connectivity.
6. Correct the configuration or application issue.
7. Restart or redeploy the API service.
8. Verify that the health endpoint responds successfully.
9. Verify that the readiness endpoint reports the database as available.
10. Test an authenticated API request.

A complete API-process outage may not be captured by the internal
uptime monitor. Independent external monitoring is required to measure
such outages accurately.

### Scenario C: Scoring service failure

1. Inspect the ipp-scoring service logs in Render.
2. Verify that the Python application starts successfully.
3. Check SCORING_SERVICE_URL and SCORING_SERVICE_TOKEN.
4. Restore the scoring service.
5. Verify its `/health` endpoint.
6. Test the aptitude-test scoring flow.

The API also has a built-in Node.js scoring fallback when the external
scoring service is unavailable.

## 7. Database Backup and Restoration

The application uses MongoDB Atlas when deployed.

The repository does not configure or demonstrate an automated database
backup schedule.

For production deployment:

1. Configure and verify an appropriate MongoDB Atlas backup policy.
2. Restrict access to backup data.
3. Record the backup retention policy.
4. Use the database provider's supported restoration procedure when recovery
   from data loss is required.
5. Verify restored collections and application connectivity.
6. Test important application operations after restoration.

Backup availability and restoration must be verified in the database
provider dashboard. Do not assume that a backup exists without confirmation.

## 8. Recovery Verification and Testing

Run the backend tests from the server directory:

    npm test

The uptime-specific tests can be run separately:

    node --require ./tests/setup.js --test tests/uptime.test.js

    node --require ./tests/setup.js --test tests/uptimeService.test.js

The tests verify:

- Detection of simulated MongoDB unavailability.
- Recording downtime after simulated database recovery.
- Monthly uptime calculation.
- Exclusion of scheduled maintenance.
- Handling of ongoing outages.
- Merging overlapping downtime intervals.
- Rejection of future-month reports.
- Evaluation against the 99.5% target.

These tests simulate database connection-state changes. They do not
constitute a real production outage or disaster-recovery drill.

A production recovery exercise should separately verify database
restoration, application restart and end-to-end availability.

## 9. Render Deployment Considerations

The project defines three Render services:

- ipp-api: Node.js backend.
- ipp-scoring: Python/Flask scoring service.
- ipp-client: Static frontend.

The current Render configuration uses `/api/health` as the API health-check path.

The Render free plan has important availability limitations:

- Services may sleep after approximately 15 minutes of inactivity.
- The first request after sleeping may take approximately 30–60 seconds.
- Resume files stored on local disk may be lost after deployment or restart.

Therefore, the free hosting configuration should not be treated as proof
of achieving the 99.5% production uptime target.

## 10. Future Improvements

The following improvements are recommended for production:

- Configure independent external uptime monitoring.
- Maintain durable outage records outside the monitored application.
- Configure availability alerts for administrators.
- Configure and test automated database backups.
- Conduct periodic recovery and restoration exercises.
- Use persistent or object storage for uploaded resumes.
- Use hosting infrastructure suitable for the required availability target.

## 11. Requirement Traceability

| Requirement | Implementation |
|---|---|
| 99.5% monthly uptime target | Monthly uptime calculation and target evaluation |
| Downtime monitoring | Internal MongoDB connectivity monitoring |
| Downtime recording | Downtime MongoDB model |
| Failure logging | Application logger |
| Recovery procedures | This document |
| Recovery verification | Automated uptime tests and documented recovery checks |

