# Online Internship & Placement Preparation Portal (IPP)

**Team 6 | PES University, Bengaluru — B.Tech CSE**

The **Online Internship & Placement Preparation Portal (IPP)** is a web-based platform designed to connect students with internship opportunities and support internship applications, aptitude/coding preparation, progress tracking, and placement analytics.

The project is documented through three main documents:

1. **Software Requirements Specification (SRS)**
2. **Software Test Plan (STP)**
3. **Software Architecture and Design Specification (SAD)**

---

## 1. Project Information

| Item | Details |
|---|---|
| Project | Online Internship & Placement Preparation Portal |
| Team | Team 6 |
| Institution | PES University, Bengaluru — B.Tech CSE |
| Technology | MERN Stack with Python for analytics |
| Version | 1.0 |

### Team Members

| SRN | Team Member |
|---|---|
| PES2UG24CS186 | HARSHITH |
| PES2UG24CS190 | HEEMADHAWALA R |
| PES2UG24CS208 | JOSHWIN PAUL |
| PES2UG24CS214 | KANISHQ SURENDRAN |

**Faculty Guide:** Prof. Sheela Devi

---

# 2. Software Requirements Specification (SRS)

The **SRS v1.0** defines the functional requirements, non-functional requirements, external interfaces, system features, quality attributes, acceptance criteria, system models and requirements traceability for IPP.

### Main Functional Areas

- Role-based registration and authentication
- Internship listing creation, search and filtering
- Resume upload and internship application
- Application status tracking
- Interview scheduling
- Timed aptitude/coding tests
- Automatic MCQ evaluation
- Test analytics
- Student progress dashboard
- Placement analytics and reporting
- Recruiter approval
- Role-Based Access Control (RBAC)
- Audit logging
- Notifications

### Main User Roles

- **Student**
- **Recruiter/Company**
- **Placement Officer/Admin**

### Important SRS Requirements

The SRS defines requirements **IPP-F-001 through IPP-F-024**, covering authentication, internship listings, applications, aptitude tests, dashboards, analytics, administration and security-related functionality.

The SRS also defines non-functional requirements for:

- Performance
- Availability
- Security
- Accessibility
- Scalability
- Maintainability

### Out of Scope

- Payroll/HR onboarding after selection
- Payment processing
- Third-party Applicant Tracking System (ATS) integration

---

# 3. Software Test Plan (STP)

The **Software Test Plan v1.0** defines how the IPP system will be tested and verified against the SRS.

### Test Items

Testing covers:

- Authentication & User Management
- Internship Listings & Search
- Application Management
- Aptitude Test module
- Python scoring/analytics microservice
- Progress Tracking & Analytics Dashboard
- Admin & Placement Officer module

### Testing Levels

The test strategy includes:

1. **Unit Testing**
2. **Integration Testing**
3. **System Testing**
4. **Acceptance Testing (UAT)**

### Testing Types

- Functional testing
- Regression testing
- Performance testing
- Usability testing
- Accessibility testing
- Security testing

### Security Validation

Security testing covers:

- Password hashing
- TLS 1.2+
- JWT lifetime and refresh-token revocation
- Input validation and sanitization
- NoSQL injection and XSS protection
- Rate limiting
- Resume upload validation
- RBAC enforcement

### Testing Tools

- **Selenium / Cypress** — UI automation
- **Postman** — API testing
- **JMeter / k6** — performance testing
- **OWASP ZAP** — security testing
- **Lighthouse / axe** — accessibility testing
- **Jira / GitHub Issues** — defect tracking

### Test Deliverables

- Test Plan
- Test Cases
- Test Scripts
- Test Data
- Test Execution Logs
- Defect Reports
- Test Summary Report

### Test Traceability

The STP maintains an **RTM (Requirements Traceability Matrix)** linking SRS requirements to corresponding test cases.

---

# 4. Software Architecture and Design Specification (SAD)

The **SAD v1.0** converts the requirements from the SRS into architectural and detailed design decisions.

It covers:

- System architecture
- Component structure
- Architecture pattern
- Technology stack
- Data stores
- UML component diagram
- UML sequence diagrams
- REST API design
- Security architecture
- Error handling
- Logging and monitoring
- UX design
- Risks and mitigations
- Requirement traceability

## Architecture

IPP uses a **hybrid architecture** consisting of a layered Node.js/Express API and a specialized Python/Flask microservice for aptitude-test scoring and analytics.

```text
                    React.js Client
             Student / Recruiter / Admin
                         |
                      HTTPS
                         |
                         v
              Node.js / Express REST API
              ┌─────────────────────────┐
              │ Controller Layer        │
              │ Service Layer           │
              │ Repository / Mongoose   │
              │ RBAC + Validation       │
              └───────────┬─────────────┘
                          |
             ┌────────────┴────────────┐
             v                         v
        MongoDB                 Python / Flask
                                  Analytics &
                                  Scoring
```

The system also integrates with:

- Email/SMS provider for OTPs and notifications
- File/object storage for resume PDFs

### Technology Stack

- **Frontend:** React.js
- **Backend:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Analytics/Scoring:** Python + Flask
- **Authentication:** JWT
- **Password Hashing:** bcrypt/Argon2
- **File Storage:** Cloud/local object storage
- **CI/CD:** GitHub Actions
- **Testing:** Jest/Mocha/Chai, pytest, Cypress/Selenium

### UML Design

The SAD contains three main sequence flows:

1. **Student Registration & JWT Login**
2. **Apply to Internship with Resume Upload**
3. **Take Aptitude Test & View Score**

The SAD also contains a component UML diagram showing the React client, Express API layers, MongoDB, Python analytics/scoring service, email/SMS provider and resume storage.

### API Design

Representative API contracts include:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/applications
POST /internal/analytics/score-test
```

### Security Architecture

The SAD uses a **STRIDE-based threat model** covering:

- Spoofing
- Tampering
- Repudiation
- Information Disclosure
- Denial of Service
- Elevation of Privilege

Security controls include JWT authentication, TLS 1.2+, password hashing, input validation, rate limiting, account lockout, audit logging and API-level RBAC.

---

# 5. Relationship Between the Three Documents

The three documents work together:

```text
             SRS
              |
              | Defines
              v
     Requirements & Scope
              |
        ┌─────┴─────┐
        v           v
       SAD         STP
        |           |
        | Defines   | Defines
        v           v
 Architecture    Testing &
 & Design        Verification
        \           /
         \         /
          v       v
          Complete
        IPP Project
```

### SRS → SAD

The **SRS defines what the system must do**, while the **SAD explains how the system is structured and designed to satisfy those requirements**.

### SRS → STP

The **SRS defines the requirements**, while the **STP defines how those requirements will be tested and verified**.

### SAD → STP

The **SAD describes the components, APIs, services and architecture**, while the **STP defines testing at unit, integration, system and acceptance levels for those components and flows**.

---

# 6. Documentation Status

| Document | Version | Purpose |
|---|---:|---|
| SRS | 1.0 | Requirements and acceptance criteria |
| STP | 1.0 | Testing strategy and verification |
| SAD | 1.0 | Architecture and detailed design |

All three documents are currently marked as **Draft for Review** in their respective documents.

---

# 7. References

The project documentation consists of:

- **Software Requirements Specification (SRS) v1.0**
- **Software Test Plan (STP) v1.0**
- **Software Architecture and Design Specification (SAD) v1.0**

---

# 8. How to Run

See [PLAN.md](PLAN.md) for the implementation plan, folder structure, schemas and API routes.

### Prerequisites

- Node.js 18+ and npm
- MongoDB (local instance, Docker, or a MongoDB Atlas connection string)

### Server (`server/`)

```bash
cd server
cp .env.example .env      # then edit MONGODB_URI and JWT_ACCESS_SECRET
npm install
npm run dev               # http://localhost:5000  (GET /health -> ok)
```

### Client (`client/`)

```bash
cd client
cp .env.example .env      # VITE_API_URL defaults to http://localhost:5000/api
npm install
npm run dev               # http://localhost:5173
```

> Aptitude-test scoring currently runs inside the Node API (`ScoringService`). The Python/Flask microservice from the SAD can be swapped in later behind the same service interface.
