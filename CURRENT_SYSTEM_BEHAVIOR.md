# Current system behavior (Family Hub)

Single reference for how the Vite + React frontend, Express API, and MongoDB backend behave **today**. Use this file for inline review; corrections belong in `USER_FLOW_REVIEW.md` or as replies to your team.

**Paths** are relative to the `family-hub/` folder unless noted.

---

## 1. Authentication and sessions

### JWT storage (frontend)

- On successful login, `AuthContext` stores:
  - `school_user` — JSON stringified user object (`localStorage`).
  - `auth_token` — JWT string (`localStorage`).
- `apiCall` (`src/lib/api.ts`) sends `Authorization: Bearer <auth_token>` when present.
- **Demo login** (when enabled) stored token literal `demo-token` — not a valid JWT for `/api/auth/me`.

### Backend login and profile

| Endpoint | Auth | Handler |
|----------|------|---------|
| `POST /api/auth/login` | Public | `backend/src/controllers/authController.ts` → `login` |
| `GET /api/auth/me` | JWT (`authMiddleware`) | `authController.ts` → `getMe` |

- Login body (Zod): `email`, `password`, optional `role` (`teacher` \| `parent` \| `student` \| `admin`). If `role` is sent, it must match the user’s role or the API returns a generic invalid-credentials response.
- JWT is created in `backend/src/utils/auth.ts` (not duplicated here).
- Inactive users (`isActive === false`) get `403` on login and on `me`.

### Frontend login flow (`src/contexts/AuthContext.tsx`)

1. `POST` via `apiCall('/auth/login', …)` with `{ email, password, role }`.
2. On success: `user` + `token` from response.
3. **After Phase 2 changes:** demo credentials and mock fallbacks apply **only in development** (see section 4).

### Demo credentials (reference only — dev-only after implementation)

Exact keys in `DEMO_CREDENTIALS` (email → password / role):

| Email | Password | Role |
|-------|----------|------|
| `teacher@vainateya.edu` | `teacher123` | teacher |
| `parent@vainateya.edu` | `parent123` | parent |
| `student@vainateya.edu` | `student123` | student |
| `admin@vainateya.edu` | `admin123` | admin |
| `vv.chiplunkar@vainateya.edu` | `Teacher@2025` | teacher |
| `admin@vainateya.school` | `Admin@2025` | admin |

### `enrolledStudents` (teacher UI)

- Previously initialized from `MOCK_STUDENTS` in `src/lib/mockData.ts` for all builds.
- **After Phase 2:** seeded from mock data only when running Vite in **development** with `VITE_API_URL` unset; otherwise starts empty and grows via real `POST /api/teacher/enroll`.

---

## 2. API surface (Express mounts)

Same route table is registered in `backend/src/server.ts` and `api/index.ts` (Vercel serverless). All paths below are under the app’s `/api` prefix (full path e.g. `/api/students`).

| Mount | Auth / roles | Controller / routes file |
|-------|----------------|---------------------------|
| `/api/health` | Public | Inline in `server.ts` / `api/index.ts` |
| `/api/auth` | Mixed: `POST /login` public; `GET /me` JWT | `routes/authRoutes.ts` → `authController` |
| `/api/students` | JWT | `routes/studentRoutes.ts` → `studentController` |
| `/api/teacher` | JWT; `/enroll` requires `teacher` | `routes/teacherRoutes.ts` → `teacherController` |
| `/api/homework` | JWT; create requires `teacher` | `routes/homeworkRoutes.ts` → `homeworkController` |
| `/api/attendance` | JWT; `POST` requires `teacher` | `routes/attendanceRoutes.ts` → `attendanceController` |
| `/api/scores` | JWT; `POST` requires `teacher` | `routes/scoresRoutes.ts` → `scoresController` |
| `/api/events` | `GET` public; mutating routes `teacher` | `routes/eventRoutes.ts` → `eventController` |
| `/api/meetings` | JWT; create / status `teacher` | `routes/meetingRoutes.ts` → `meetingController` |
| `/api/instructions` | JWT; `POST` requires `teacher` | `routes/instructionRoutes.ts` → `instructionController` |
| `/api/quizzes` | JWT; role rules per route | `routes/quizRoutes.ts` → `quizController` |
| `/api/admin` | JWT + `admin` | `routes/adminRoutes.ts` → `adminController` |
| `/api/enquiry` | Public `POST /`, public `GET /:enquiryId` | `routes/enquiryRoutes.ts` → `enquiryController` |
| `/api/notifications` | JWT | `routes/notificationRoutes.ts` → `notificationController` |
| `/api/report-cards` | JWT; teacher for some writes | `routes/reportCardRoutes.ts` → `reportCardController` |

### Public enquiry contract (`POST /api/enquiry`)

Validated in `enquiryController.ts` (Zod):

- `name` — non-empty string  
- `email` — valid email  
- `phone` — exactly **10 digits** (numeric string)  
- `message` — minimum **10 characters**  

Optional email to school uses `process.env.SCHOOL_EMAIL || process.env.MAIL_USER`.

---

## 3. Frontend ↔ API mapping

Frontend `apiCall` uses paths **without** the `/api` prefix; `API_BASE_URL` is `/api` (relative) or `VITE_API_URL` (absolute, should include `/api` suffix in production).

### Mock behavior (see section 4)

When mocks are active, `getMockResponse` in `src/lib/api.ts` may satisfy the request **before** `fetch`, or on error. Handled paths include: `/auth/me`, `/students`, `/teacher/enroll`, `/homework`, `/scores`, `/quizzes`, `/meetings`, `/instructions`, `/events`, `/attendance`, `/admin/dashboard`. **`/enquiry` is not mocked** — it always uses the network when `apiCall` runs.

### By role / area

| Area | Page(s) | `apiCall` paths | Notes |
|------|---------|-----------------|-------|
| Auth | Login | `/auth/login` | Demo fallback was dev-only after implementation |
| Teacher | Dashboard, attendance, homework, meetings, analytics, progress | `/students`, `/meetings`, `/homework`, `/attendance`, `/scores`, `/scores?studentId=` | |
| Parent | Dashboard, homework, progress | `/instructions`, `/meetings`, `/events?…`, `/homework`, `/scores` | |
| Student | Dashboard, quizzes | `/scores`, `/homework`, `/quizzes`, `/quizzes/:id/submit` | |
| Admin | Dashboard | `/admin/dashboard` | Other admin routes exist on backend; not all wired in this UI slice |
| Public | Admissions, Index (contact) | `POST /enquiry` via `submitEnquiry` | Wired to `enquiryController` |

### UI actions with no API (before Phase 2)

- **Admissions** and **Index** “चौकशी” form used `setTimeout` or `preventDefault` only — **fixed** to call `POST /api/enquiry` with validation UX.

---

## 4. Mock and demo policy (target behavior)

| Condition | Behavior |
|-----------|----------|
| `import.meta.env.PROD` | **No** `getMockResponse` short-circuit; **no** mock fallback on HTTP or network errors; **no** demo login; **no** mock seed for `enrolledStudents`. |
| `import.meta.env.DEV` and `VITE_API_URL` **unset** | `USE_MOCK` true: GETs listed in `getMockResponse` can return mock data; errors may fall back to mock where implemented; demo login allowed; teacher `enrolledStudents` seeded from `MOCK_STUDENTS`. |
| `import.meta.env.DEV` and `VITE_API_URL` **set** | Same as production regarding mocks and demo (real API only). |

**Recommendation for final client-facing deployment:** set `VITE_API_URL` to your deployed API origin including `/api`, use only database users for login, and keep `JWT_SECRET` / `MONGODB_URI` server-side only.

---

## 5. Deployment

### Required / important environment variables

**Backend / Vercel function**

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection (required for local `server.ts` startup) |
| `JWT_SECRET` | Signing key (required for local `server.ts` startup) |
| `FRONTEND_URL` | CORS allowlist entry (see below) |
| `CORS_ORIGINS` | Optional comma-separated extra origins (merged with defaults + `FRONTEND_URL`) |
| `SCHOOL_EMAIL` or `MAIL_USER` | Enquiry notification email target |
| Email SMTP vars | As used by `backend/src/utils/email.ts` |

**Frontend build (`VITE_*`)**

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Absolute API base including `/api` in production (e.g. `https://your-app.vercel.app/api`) |
| `VITE_SCHOOL_*` | Display/contact copy — see `/.env.example` |

### CORS

- **After implementation:** origins = default localhost origins + any hostnames in `CORS_ORIGINS` + `FRONTEND_URL` (no hardcoded LAN IPs in repo).
- **Vercel `api/index.ts`:** same helper for parity.

### Vercel (`vercel.json`)

- `VITE_API_URL` set in `env` for production builds.
- `rewrites`: `/api/(.*)` → `/api` (serverless entry `api/index.ts`).
- `outputDirectory`: `dist`; framework Vite.

### Dev proxy (`vite.config.ts`)

- `/api` → `http://localhost:9000` (backend `PORT` in `server.ts` is **9000**).

---

## 6. Related files

- School display/contact: `src/config/school.ts` (and `VITE_SCHOOL_*` in `.env.example`). Stakeholder-facing **contact table** (production targets, placeholders noted) lives in **`USER_FLOW_REVIEW.md`** § “Final school / contact block”; keep env and that table in sync when details are finalized.
- Public enquiry email target (`POST /api/enquiry` notifications) is **`SCHOOL_EMAIL` or `MAIL_USER`** on the server, not `VITE_SCHOOL_*`. For a single “office inbox,” set backend env to the same address you publish as general email (see `USER_FLOW_REVIEW.md` notes).
- User flow review / corrections: `USER_FLOW_REVIEW.md`

---

*Last updated: implementation pass aligned with plan phases 1–4 (see git history for exact commit).*
