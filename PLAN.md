# IPP — Implementation Plan

Source of truth: `6_SRS.pdf`, `6_SAD.pdf`, `6_TestPlan.pdf`, `README.md`, `UML_diagrams/`.
Nothing here adds features beyond those documents. Where the documents leave a detail open, it is marked **(decision)**.

## 1. Scope decisions

| Topic | Decision |
|---|---|
| Python/Flask scoring service | Skipped for now. Scoring runs in Node behind `ScoringService` (a small interface: `scoreAttempt(payload) -> { score, accuracy, timePerQuestion[], categoryBreakdown }`). The shape matches `POST /internal/analytics/score-test` in the SAD, so a Flask-backed implementation can replace the Node one without touching controllers. |
| Email / SMS provider | `Mailer` interface. Dev implementation logs the message (OTP / reset link) to the server console; a real provider (SMTP/SendGrid) can be added later. Retry-with-backoff wrapper per SRS 3.4. |
| File storage | Local disk (`server/uploads/`) in dev behind a `StorageService` interface (SRS 3.3 allows "local disk in development"). |
| Admin accounts | Register only allows `student` / `recruiter` (SAD 4.3). Placement Officer/Admin accounts are created by a seed script. |
| Refresh tokens | Opaque random token, stored hashed in DB, rotated on use, revocable (IPP-SR-002). Sent as an httpOnly cookie. Access token (JWT, 15 min, max 60 per SR-002) returned in the body as `{ token, expiresIn, role }` per SAD. |
| Password hashing | bcrypt (IPP-F-003). |

## 2. Requirements by module

### Auth & User Management (Auth Controller + Users collection) — SAD 3.8: F-001…F-005
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-001 | Role-based registration (student/recruiter) with email OTP verification | M1 |
| IPP-F-002 | Email/password login, signed JWT | M1 |
| IPP-F-003 | bcrypt-hashed passwords, never plaintext | M1 |
| IPP-F-004 | Lock account 15 min after 5 consecutive failed logins; audit-log entry | M1 |
| IPP-F-005 | Password reset via emailed link, 30 min expiry, single use | M2 |

### Internship Listings & Search — F-006…F-009
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-006 | Verified recruiters create/edit/publish listings (role, stipend, duration, skills, deadline); visible to students only after admin approval | M3 |
| IPP-F-007 | Search/filter by domain, location, stipend, duration (≤ 2 s, text/compound index, paginated) | M3 |
| IPP-F-008 | Listing detail: company profile, eligibility, deadline | M3 |
| IPP-F-009 | Auto-hide listings after deadline (scheduled job) | M3 |

### Application Management — F-010…F-013
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-010 | Upload resume (PDF ≤ 5 MB) and apply in one action; duplicates blocked | M4 |
| IPP-F-011 | Recruiter views/filters/updates status (Applied, Shortlisted, Rejected, Selected) | M4 |
| IPP-F-012 | Email + in-app notification on status change (within 1 min) | M4 |
| IPP-F-013 | Recruiter schedules/records interview (date, mode, link) for shortlisted candidates | M4 |

### Aptitude Test Module (Test Controller + scoring service) — F-014…F-017
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-014 | Timed MCQ/coding tests from configurable question bank; auto-submit at zero; randomized per attempt; progress auto-save | M5 |
| IPP-F-015 | Auto-evaluate MCQs, show score immediately | M5 |
| IPP-F-016 | No reattempt unless admin re-enables (override creates new attempt record) | M5 |
| IPP-F-017 | Record analytics per attempt (accuracy, time/question, category-wise) | M5 |

### Progress Tracking & Analytics — F-018…F-021
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-018 | Student dashboard: applications, interviews, test scores | M6 |
| IPP-F-019 | Placement officer analytics: placement rate, company-wise applications, performance trends | M6 |
| IPP-F-020 | Bar/line/pie charts, last 12 months | M6 |
| IPP-F-021 | Export analytics CSV/PDF | M6 |

### Admin & Placement Officer — F-022…F-024
| ID | Requirement | Milestone |
|---|---|---|
| IPP-F-022 | Approve/reject recruiter registrations (and listings per F-006) | M3 (backend), UI M3 |
| IPP-F-023 | RBAC on every route; out-of-role access → 403 and logged | M1 (middleware), enforced per route afterwards |
| IPP-F-024 | Audit log of admin actions (approvals, deletions, role changes): timestamp + actor ID | M1 (model/service), used by every admin action |

Non-functional / security carried through all milestones: SR-002 (JWT ≤ 60 min, revocable refresh) M1, SR-003 (validation + NoSQL-injection/XSS sanitization) M1, SR-004 (rate limit on auth + uploads) M1/M4, SR-005 (PDF-only, 5 MB, content check) M4, SR-006 (RBAC at API layer + automated RBAC tests) M1 onward, NF-001 (≤ 3 s p90, indexes, pagination), NF-004 (WCAG 2.1 AA: labels, keyboard nav, high-contrast), NF-005 (stateless API), NF-006 (modular, ≥ 70 % coverage of auth/applications/tests).
Admin module also covers use-case "Manage Users & Roles" and "Configure Aptitude Test Bank" (UML Fig. 2).

## 3. Final folder structure

```
/
├── PLAN.md  README.md  .gitignore
├── 6_SRS.pdf 6_SAD.pdf 6_TestPlan.pdf  UML_diagrams/
├── server/
│   ├── package.json  .env.example
│   └── src/
│       ├── app.js              # express app (helmet, cors, sanitize, routes, error handler)
│       ├── server.js           # connect DB, start HTTP, cron jobs
│       ├── config/             # env.js (validated config), db.js
│       ├── utils/              # logger.js (winston), AppError.js, asyncHandler.js, tokens.js
│       ├── middleware/         # auth.js (JWT), rbac.js, validate.js, rateLimit.js, upload.js, errorHandler.js, sanitize.js
│       ├── models/             # User, RefreshToken, AuditLog, Listing, Application, Question, TestAttempt, Notification
│       ├── repositories/       # one per model — all Mongoose access lives here
│       ├── services/           # authService, userService, listingService, applicationService, testService,
│       │                       #   scoringService (swap point for Flask), analyticsService, notificationService,
│       │                       #   auditService, mailer, storageService
│       ├── controllers/        # auth, listing, application, test, dashboard, admin
│       ├── routes/             # auth.routes.js, listing.routes.js, ... index.js mounts under /api
│       ├── validators/         # Joi/zod-style schemas per route
│       ├── jobs/               # deadline hide cron
│       └── scripts/            # seedAdmin.js, seedDemo.js
│   └── tests/                  # jest + supertest (mongodb-memory-server)
└── client/
    ├── package.json  .env.example  vite.config.js
    └── src/
        ├── main.jsx  App.jsx
        ├── api/                # axios instance, per-module api files, refresh interceptor
        ├── context/            # AuthContext
        ├── components/         # ProtectedRoute, RoleRoute, forms, layout, charts
        ├── pages/
        │   ├── auth/           # Login, Register, VerifyEmail, ForgotPassword, ResetPassword
        │   ├── student/        # Dashboard, Listings, ListingDetail, Applications, Tests, TestRunner
        │   ├── recruiter/      # Dashboard, MyListings, Applicants
        │   └── admin/          # Dashboard, Approvals, Users, QuestionBank, Analytics
        └── styles/
```

Request flow: `route → (rateLimit, auth, rbac, validate) → controller → service → repository → Mongoose model`. Controllers never touch models; services hold business rules; repositories hold queries.

## 4. Mongoose schemas

All schemas use `timestamps: true`. `ObjectId` refs shown as `→Model`.

```
User
  name String req · email String req unique lowercase · passwordHash String req (select:false)
  role enum[student, recruiter, admin] req
  emailVerified Boolean=false · otpHash String · otpExpiresAt Date · otpAttempts Number
  approvalStatus enum[pending, approved, rejected]  (recruiters start pending; students/admin 'approved')
  failedLoginAttempts Number=0 · lockUntil Date
  passwordResetTokenHash String · passwordResetExpiresAt Date           (M2)
  profile { phone, college, branch, graduationYear, skills[], companyName, companyDescription, website }
  isActive Boolean=true

RefreshToken
  user →User · tokenHash String unique · expiresAt Date (TTL index) · revokedAt Date · replacedBy →RefreshToken
  createdByIp String · userAgent String

AuditLog
  actor →User (nullable for anonymous events) · action String (e.g. LOGIN_LOCKOUT, RECRUITER_APPROVED, RBAC_DENIED)
  targetType String · targetId ObjectId · metadata Mixed (no secrets) · ip String · createdAt

Listing                                                                    (M3)
  recruiter →User · title/role String · company String · description String · domain String · location String
  stipend Number · duration Number (months) · skills[String] · eligibility String · deadline Date
  status enum[draft, pending_approval, approved, rejected, closed] · approvedBy →User
  indexes: text(title, description, skills), compound(domain, location, stipend, duration, status, deadline)

Application                                                                (M4)
  student →User · listing →Listing · resumePath String · resumeOriginalName String
  status enum[Applied, Shortlisted, Rejected, Selected]=Applied
  interview { date, mode enum[online, in-person], link, notes }
  unique index (student, listing)

Notification                                                               (M4)
  user →User · type String · message String · read Boolean=false · link String

Question                                                                   (M5)
  text String · type enum[mcq, coding] · options[String] · correctIndex Number (select:false for students)
  category String · difficulty String · marks Number · active Boolean

Test                                                                       (M5)
  title · durationMinutes · questionCount · categories[] · isActive

TestAttempt                                                                (M5)
  student →User · test →Test · questions[{ question →Question, order }] · answers[{ question, selectedIndex, timeSpentSec }]
  startedAt · expiresAt · submittedAt · status enum[in_progress, submitted, auto_submitted]
  score Number · accuracy Number · timePerQuestion[] · categoryBreakdown Mixed · attemptNo Number
  reenabledBy →User
```

## 5. API routes

Base path `/api`. Error envelope everywhere: `{ status, code, message }` (SAD 4.4). Roles: S=student, R=recruiter, A=admin.

**Auth** (M1 unless noted)
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public, rate-limited | `{name,email,password,role}` → `201 {status:"pending_verification", userId}`; 400 / 409 |
| POST | `/auth/verify-email` | public, rate-limited | `{userId,otp}` → verified |
| POST | `/auth/resend-otp` | public, rate-limited | |
| POST | `/auth/login` | public, rate-limited | `{email,password}` → `200 {token, expiresIn, role}` + refresh cookie; 401; 423 locked |
| POST | `/auth/refresh` | cookie | rotates refresh token, returns new access token; reuse of revoked token revokes the family |
| POST | `/auth/logout` | cookie | revokes refresh token |
| GET | `/auth/me` | any authed | current user |
| POST | `/auth/forgot-password`, `/auth/reset-password` | public | M2 |
| GET/PATCH | `/users/me` | any authed | profile (M2) |

**Listings** (M3): `GET /listings` (S, filters+pagination), `GET /listings/:id` (S/R/A), `POST /listings` (R approved), `PATCH /listings/:id` (R owner), `GET /listings/mine` (R).
**Applications** (M4): `POST /applications` (S, multipart), `GET /applications/mine` (S), `GET /listings/:id/applications` (R owner), `PATCH /applications/:id/status` (R), `PUT /applications/:id/interview` (R), `GET /applications/:id/resume` (S owner / R owner), `GET /notifications`, `PATCH /notifications/:id/read`.
**Tests** (M5): `GET /tests` (S), `POST /tests/:id/start` (S), `PUT /attempts/:id/answers` (S, autosave), `POST /attempts/:id/submit` (S), `GET /attempts/mine` (S), `GET /attempts/:id/result` (S), admin question bank CRUD `/admin/questions`, `POST /admin/attempts/:id/reenable` (A).
**Dashboards** (M6): `GET /dashboard/student` (S), `GET /dashboard/placement` (A), `GET /dashboard/placement/export?format=csv|pdf` (A).
**Admin** (M3+): `GET /admin/recruiters?status=pending`, `PATCH /admin/recruiters/:id` (approve/reject), `PATCH /admin/listings/:id` (approve/reject), `GET /admin/users`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`, `GET /admin/audit-logs`.
**Ops**: `GET /health`.

## 6. Build order and milestones

| # | Branch | Deliverable | Reqs |
|---|---|---|---|
| Setup | `chore/plan-and-setup` | PLAN.md, `client/` (React+Vite), `server/` (Express+Mongoose), `.env.example`s, README "How to run" | — |
| M1 | `feat/m1-auth-rbac` | Mongo config, logger, error handling, User/RefreshToken/AuditLog models, register + OTP verify, login, refresh, logout, JWT + RBAC middleware, rate limiting, lockout; client login/register/verify, AuthContext, protected + role-based routes, empty dashboard per role | F-001–004, F-023, F-024 (infra), SR-002/003/004/006, NF-003 |
| M2 | `feat/m2-password-reset-profile` | Forgot/reset password, profile edit | F-005 |
| M3 | `feat/m3-listings-admin-approval` | Listings CRUD, search/filter, detail, deadline cron, recruiter + listing approval, audit log on admin actions, user management | F-006–009, F-022, F-024 |
| M4 | `feat/m4-applications` | Resume upload + apply, recruiter review/status, interviews, notifications | F-010–013, SR-005 |
| M5 | `feat/m5-aptitude-tests` | Question bank, timed tests, autosave, Node scoring service, analytics record, reattempt rule | F-014–017 |
| M6 | `feat/m6-dashboards-analytics` | Student dashboard, placement analytics, charts, CSV/PDF export | F-018–021 |
| M7 | `feat/m7-hardening-tests` | RBAC test suite on every endpoint, ≥ 70 % coverage on auth/applications/tests, accessibility pass (high-contrast, keyboard), seed data | NF-004, NF-006, SR-006 |

Each milestone is developed on its own branch from an up-to-date `main`, merged into `main` when working, then old branches are pruned (keep the 4 most recent).
