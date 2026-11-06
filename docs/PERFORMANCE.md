# Performance and Scalability (IPP-NF-001, IPP-NF-005)

## 1. Performance Requirements

The revised Software Requirements Specification (SRS) defines the following performance requirements.

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| IPP-NF-001 | The application should support up to 5 concurrent users under normal operating conditions. | 5 concurrent virtual users successfully complete the performance test. |
| IPP-NF-001 | Page load and API response times should remain within the specified limits. | Overall API response p90 ≤ 8 seconds. |
| IPP-NF-001 | Listing search and filtering should respond efficiently. | Listing search p90 ≤ 5 seconds. |
| IPP-NF-005 | The application should handle twice the baseline concurrent load. | Successfully handle 10 concurrent virtual users. |
| IPP-F-007 | Search and filtering should respond within the specified time. | Listing search p90 ≤ 5 seconds. |

The performance tests use k6 to measure response times, throughput, request failures, and application errors.

The revised SRS focuses on a 5-user baseline and a 10-user test representing twice the baseline load.

## 2. Performance Testing Tools

Two performance-testing tools are available in the project.

| Tool | Location | Purpose |
|---|---|---|
| k6 | `perf/k6/load.js` | Simulates concurrent users and measures API performance. |
| Node benchmark | `perf/bench.js` | Provides a lightweight performance benchmark using Node.js. |

### 2.1 k6 Load Test

The k6 script simulates user activity by sending requests to the application API.

It performs operations such as:

- User authentication.
- Fetching internship listings.
- Searching and filtering listings.
- Viewing listing details.
- Accessing student dashboards.
- Viewing applications.
- Fetching available assessments.

The script records:

- Total HTTP requests.
- Request throughput.
- Average response time.
- p90 and p95 response times.
- HTTP request failure rate.
- Application error rate.
- Endpoint-specific response times.

### 2.2 Running the k6 Test

Install k6 from:

https://k6.io/

Run the test from the project root directory.

Example command for the revised 5-user requirement:

```bash
k6 run -e BASE_URL=http://127.0.0.1:5001/api \
-e PEAK_VUS=5 \
-e RAMP=5s \
-e HOLD=15s \
perf/k6/load.js
```

Example command for the 10-user test:

```bash
k6 run -e BASE_URL=http://127.0.0.1:8080/api \
-e PEAK_VUS=10 \
-e RAMP=5s \
-e HOLD=15s \
perf/k6/load.js
```

The 5-user test uses a single API instance. The 10-user test uses five local API instances behind the local load balancer.

### 2.3 Node Benchmark

The project also includes a Node.js benchmark.

Example:

```bash
node perf/bench.js --url http://localhost:5000 --concurrency 50 --requests 1500
```

This benchmark reports:

- p50 response time.
- p90 response time.
- p99 response time.
- Requests per second.
- Error rate.

It is useful for exploratory performance measurements.

## 3. Test Environment and Configuration

The performance tests were conducted using a Windows development laptop.

The application API and load generator were executed locally. The application communicates with MongoDB Atlas.

The local load-balancer setup used five API processes running on different ports.

| Component | Configuration |
|---|---|
| Operating system | Windows |
| Backend | Node.js / Express |
| Database | MongoDB Atlas |
| Performance testing tool | k6 |
| Single API instance | Port 5001 |
| Additional API instances | Ports 5002–5005 |
| Local load balancer | Port 8080 |
| Load-balancer script | `perf/local-lb.js` |

### 3.1 Starting an API Instance

Open a separate terminal for each API instance.

Example for the first instance:

```powershell
cd .\server
$env:PORT="5001"
$env:JOBS_ENABLED="false"
node .\src\server.js
```

Repeat the process using ports 5002, 5003, 5004, and 5005 in separate terminals.

### 3.2 Starting the Local Load Balancer

From the project root, execute:

```powershell
node .\perf\local-lb.js
```

The load balancer listens on:

```text
http://127.0.0.1:8080
```

It distributes incoming requests among the five local API instances.

### 3.3 Checking Server Availability

The following command checks the health endpoint of all five API instances and the load balancer.

```powershell
5001,5002,5003,5004,5005,8080 | ForEach-Object {
    $port = $_
    try {
        $r = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 3
        "Port ${port}: $($r.status)"
    } catch {
        "Port ${port}: FAILED"
    }
}
```

All required services should return an `ok` status before starting a performance test.

### 3.4 Test Preparation

Before running the tests:

1. Ensure MongoDB Atlas is accessible.
2. Seed the database using `npm run seed:demo` if test data is unavailable.
3. Ensure the required API instances are running.
4. Ensure the load balancer is running when testing through port 8080.
5. Confirm that the test account credentials are configured.
6. Verify that the health endpoints respond successfully.

The API uses JWT authentication. The k6 script authenticates during setup before executing the test scenarios.

Rate limits should be configured appropriately for the test environment. Do not weaken production rate-limiting controls merely to obtain better benchmark results.

## 4. Performance Optimizations Implemented

The application includes several optimizations intended to improve API response times and database performance.

### 4.1 Database Indexing

Indexes are configured on frequently queried collections.

Examples include:

- Listing indexes on status, deadline, domain, location, stipend, and duration.
- Text indexes on listing title, description, skills, and company.
- Application indexes on student and listing.
- Application indexes on listing, status, and creation date.
- TestAttempt indexes on student, test, and attempt number.
- Notification indexes on user and creation date.

These indexes help reduce unnecessary database scanning.

### 4.2 Pagination

List endpoints support pagination.

The maximum page size is limited to avoid unnecessarily large database responses.

### 4.3 Efficient Database Queries

The backend uses Mongoose `lean()` for read-only queries where appropriate.

Independent database queries are executed in parallel using `Promise.all()`.

The analytics functionality also uses MongoDB aggregation operations where appropriate.

### 4.4 Authentication

JWT-based authentication is used to avoid maintaining per-user session state inside individual API processes.

Password hashing is performed during registration, login, and password-reset operations rather than on ordinary read requests.

## 5. Running the API Statelessly and Handling Increased Load (IPP-NF-005)

The API is designed to avoid maintaining per-user session state in process memory.

This allows multiple API instances to handle requests from the same authenticated user.

| Concern | Current Implementation | Consideration |
|---|---|---|
| Sessions | JWT access tokens and refresh tokens stored in MongoDB. | Token validation can be performed by multiple instances using shared configuration. |
| Configuration | Environment variables. | All instances must use consistent secrets and configuration. |
| File uploads | Resumes are stored using the local storage service. | Shared storage or object storage is required when instances run on separate machines. |
| Rate limiting | express-rate-limit memory store. | Counters are maintained per instance; a shared store is needed for globally consistent limits. |
| Background jobs | Listing expiry and test auto-submit jobs. | Jobs can be disabled on additional instances to avoid unnecessary duplicate execution. |
| Scoring | Executed in-process. | The scoring implementation can be replaced with a separate service if required. |
| TLS and proxy | TLS can be terminated at the load balancer. | Configure trusted proxy settings appropriately in deployment. |
| Health checks | `GET /health`. | Used to check API instance availability. |

### 5.1 Stateless Authentication Verification

The implementation was tested to verify that a token and refresh cookie issued by one API instance could be accepted by another API instance.

This helps demonstrate that authentication does not depend on a user's request returning to the same API process.

### 5.2 File Storage Consideration

The current resume storage implementation writes files to local disk through `storageService`.

When API instances are deployed on separate machines, shared storage such as NFS/EFS or an object storage service such as Amazon S3 should be configured.

Without shared storage, a file uploaded through one instance may not be accessible through another instance.

### 5.3 Rate-Limiting Consideration

The current rate limiter uses an in-memory store.

As a result, each API instance maintains its own counters.

A shared Redis-backed rate-limit store can be introduced if globally consistent rate limits are required in a distributed deployment.

## 6. Five-User SRS Acceptance Test

**Status: PASSED**

This test verifies the application's ability to handle the revised SRS baseline requirement of five concurrent users.

### 6.1 Test Configuration

| Parameter | Value |
|---|---|
| Tool | k6 |
| Target | Single API instance |
| API port | 5001 |
| Peak virtual users | 5 |
| Ramp-up | 5 seconds |
| Hold duration | 15 seconds |
| Total execution time | Approximately 30.8 seconds |

### 6.2 Test Results

| Metric | Result |
|---|---:|
| HTTP requests | 412 |
| Throughput | 13.39 requests/sec |
| Overall HTTP p90 latency | 307.82 ms |
| Listing search p90 latency | 260.09 ms |
| HTTP failure rate | 0.00% |
| Application error rate | 0.00% |
| Completed iterations | 82 |
| Checks passed | 412 / 412 |

### 6.3 Acceptance Criteria

| Acceptance Criterion | Required Value | Actual Result | Status |
|---|---:|---:|---|
| Concurrent users | 5 | 5 | PASS |
| Overall API p90 | ≤ 8 seconds | 307.82 ms | PASS |
| Listing search p90 | ≤ 5 seconds | 260.09 ms | PASS |
| HTTP failure rate | < 1% | 0.00% | PASS |
| Application error rate | < 1% | 0.00% | PASS |

### 6.4 Conclusion

The application successfully passed the five-user SRS acceptance test against a single API instance.

All 412 checks passed, with zero HTTP failures and zero application errors.

The measured overall and listing-search p90 response times were comfortably within the revised SRS limits.

## 7. Ten-User Performance Test (2× Baseline Load)

**Status: PASSED**

This test evaluates the application's ability to handle twice the revised baseline concurrent load.

The test uses ten virtual users and the five-instance local load-balancer configuration.

### 7.1 Test Configuration

| Parameter | Value |
|---|---|
| Tool | k6 |
| Target | Five API instances behind the local load balancer |
| Load-balancer address | `127.0.0.1:8080` |
| Peak virtual users | 10 |
| Ramp-up | 5 seconds |
| Hold duration | 15 seconds |
| Total execution time | Approximately 30.9 seconds |

### 7.2 Test Results

| Metric | Result |
|---|---:|
| HTTP requests | 1,182 |
| Throughput | 38.30 requests/sec |
| Overall HTTP p90 latency | 26.07 ms |
| Listing search p90 latency | 26.63 ms |
| HTTP failure rate | 0.00% |
| Application error rate | 0.00% |
| Completed iterations | 236 |
| Checks passed | 1,182 / 1,182 |

### 7.3 Acceptance Criteria

| Acceptance Criterion | Required Value | Actual Result | Status |
|---|---:|---:|---|
| Concurrent users | 10 | 10 | PASS |
| Overall API p90 | ≤ 8 seconds | 26.07 ms | PASS |
| Listing search p90 | ≤ 5 seconds | 26.63 ms | PASS |
| HTTP failure rate | < 1% | 0.00% | PASS |
| Application error rate | < 1% | 0.00% | PASS |

### 7.4 Conclusion

The application successfully completed the ten-user performance test through the five-instance local load balancer.

All 1,182 checks passed, and both HTTP and application error rates remained at zero.

The results demonstrate successful handling of ten concurrent virtual users under the tested local configuration.

## 8. Five-to-Ten-User Load Comparison

**Status: PASSED — 2× baseline-load test**

This comparison evaluates the change in throughput and response time when the number of concurrent virtual users increases from five to ten.

Both tests used the same five-instance local API configuration behind the load balancer.

### 8.1 Test Configuration

| Parameter | Five-User Test | Ten-User Test |
|---|---|---|
| Tool | k6 | k6 |
| API configuration | Five local instances | Five local instances |
| Load balancer | Port 8080 | Port 8080 |
| Peak virtual users | 5 | 10 |
| Ramp-up | 5 seconds | 5 seconds |
| Hold duration | 15 seconds | 15 seconds |

### 8.2 Comparative Results

| Metric | 5 Users | 10 Users |
|---|---:|---:|
| HTTP requests | 617 | 1,182 |
| Throughput | 20.33 req/sec | 38.30 req/sec |
| Overall p90 latency | 14.21 ms | 26.07 ms |
| Listing search p90 | 13.58 ms | 26.63 ms |
| HTTP failure rate | 0.00% | 0.00% |
| Application error rate | 0.00% | 0.00% |
| Completed iterations | 123 | 236 |

### 8.3 Analysis

When virtual users increased from five to ten, measured throughput increased from 20.33 to 38.30 requests per second.

The throughput ratio was approximately:

```text
38.30 / 20.33 = 1.88×
```

Both tests completed with zero HTTP failures and zero application errors.

Overall p90 latency increased from 14.21 ms to 26.07 ms, remaining well within the revised SRS response-time limit.

Listing search p90 latency also remained within the revised SRS limit.

### 8.4 Conclusion

The five-instance local configuration successfully handled both five-user and ten-user tests.

Throughput increased approximately 1.88 times when concurrency doubled from five to ten virtual users.

This supports the revised SRS 2× baseline-load objective in the recorded local tests.

However, both tests used the same five-instance configuration. Therefore, this comparison demonstrates increased load-handling capacity under the tested configuration, not an independent measurement of horizontal-scaling efficiency.

The five local API processes were executed on the same development laptop. They should be considered a local multi-process load-balancer simulation rather than independent production deployment instances.

## 9. Additional Historical Performance Measurements

The following measurements were collected during earlier development and exploratory testing.

They provide additional context but are not substitutes for the revised SRS acceptance tests documented above.

### 9.1 Earlier Ten-User Smoke Test

| Metric | Result |
|---|---:|
| Maximum virtual users | 10 |
| HTTP requests | 2,242 |
| Completed iterations | 448 |
| Overall HTTP p90 | 18.79 ms |
| Listing search p90 | 18.60 ms |
| HTTP failure rate | 0.00% |
| Application error rate | 0.00% |

All configured k6 checks passed during this earlier smoke test.

### 9.2 Earlier Fifty-VU Single-Instance Test

| Metric | Result |
|---|---:|
| Peak virtual users | 50 |
| Overall HTTP p90 | 1.03 seconds |
| Listing search p90 | 1.15 seconds |
| HTTP failure rate | 0.00% |
| Application error rate | 0.00% |

### 9.3 Earlier Fifty-VU Five-Instance Local Load-Balancer Test

| Metric | Result |
|---|---:|
| Peak virtual users | 50 |
| Overall HTTP p90 | 1.00 second |
| Listing search p90 | 897.96 ms |
| HTTP failure rate | 0.00% |
| Application error rate | 0.00% |

These earlier measurements were conducted on the same local development environment. They are exploratory performance evidence and are not additional revised SRS acceptance criteria.

## 10. Limitations and Considerations

The recorded tests were conducted in a local development environment.

The results are affected by:

- Available laptop CPU and memory.
- Local Node.js process scheduling.
- Network communication with MongoDB Atlas.
- Database response times.
- The local load-balancer implementation.
- The number of API processes running simultaneously.

The five API processes used in the load-balancer tests ran on one laptop. This configuration does not represent five independent production servers.

The results should therefore be interpreted as evidence that the application successfully handled the tested workloads under the recorded local conditions.

They should not be interpreted as a guarantee of production capacity or production horizontal-scaling performance.

## 11. Final Performance Acceptance Status

The revised SRS performance requirements have been validated through the recorded local k6 tests.

| Requirement / Test | Result | Status |
|---|---|---|
| Five-user baseline acceptance test | 412 checks passed, zero errors | PASSED |
| Overall API response p90 | Within 8-second limit | PASSED |
| Listing search p90 | Within 5-second limit | PASSED |
| Ten-user performance test | 1,182 checks passed, zero errors | PASSED |
| 2× baseline-load objective | Approximately 1.88× measured throughput in matched local tests | PASSED |
| Five-instance local load-balancer test | Successfully completed | PASSED |

### Overall Conclusion

The Internship Placement Portal successfully passed the revised SRS performance tests conducted using k6.

The five-user baseline test completed successfully against a single API instance. The ten-user test also completed successfully using the five-instance local load-balancer configuration.

Both tests recorded zero HTTP failures and zero application errors, with response times within the revised SRS limits.

The matched five-user and ten-user load comparison recorded approximately 1.88 times the baseline throughput when concurrency doubled.

These results provide evidence that the application meets the revised local performance and 2× baseline-load testing objectives under the configurations tested.

Production performance should be evaluated separately using an appropriately deployed environment and infrastructure.