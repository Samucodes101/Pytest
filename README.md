# PyTest: Customizable Web-Based Examination System

PyTest lets an organisation set, deliver, mark and analyse timed multiple-choice assessments for interns, corps members and job applicants, on its own infrastructure and under its own brand.

Built with React 18 + TypeScript + Tailwind (client), Node.js + Express + TypeScript (server) and MySQL 8.

Screenshots and design diagrams are in [`docs/`](docs/).

## Features

**Candidates**
- See only the exams assigned to them, with due dates and a Start / Resume / View result action
- Take exams in a distraction-free exam room: server-synchronised countdown, one question at a time, question navigator, flag for review, keyboard shortcuts (A–D, arrows), works on phones
- Answers autosave continuously; closing the browser or losing the connection loses nothing
- Instant results, a per-question review (if the examiner allows it) and a printable result slip

**Department admins** (scoped to their own department)
- Exam builder with marks, difficulty and topic per question, reordering, inline editing and **CSV import**
- Delivery settings: per-candidate question shuffling, answer-key visibility, auto-submit after N tab switches
- Assign exams with an optional due date; watch who is not started / writing / submitted
- Allow a retake (logged); deactivate / reactivate candidates (takes effect immediately)
- Dashboards, analytics, **item analysis** (difficulty and discrimination index per question, distractor counts, plain-language flags) and CSV export

**Super admin**
- Everything above, across all departments
- Departments and department admins
- **Branding**: organisation name, tagline, logo and brand colour (live preview), and the self-registration switch
- Organisation-wide audit trail

## How exam integrity works

- **The server owns the clock.** It records `started_at` when a candidate presses Start and fixes the deadline. Answers that arrive after the deadline (plus 30 s grace) are ignored and the last autosave is graded instead.
- **Abandoned attempts close themselves.** A background sweep runs every minute and grades attempts whose time has run out.
- **No double grading.** Every attempt operation locks the assignment row in a transaction, and `results.assignment_id` is unique.
- **The answer key never reaches the browser** before submission.
- **Access is checked on every request** by role *and* department. A candidate can never read another candidate's data, and admins are confined to their department.
- **Tokens are re-validated against the database** on every request, so deactivation is immediate.
- Login is rate-limited (10 attempts / 15 min per IP + email), all input is validated with Zod, and passwords are stored as bcrypt hashes.

## Quick start

Prerequisites: Node.js 18+, MySQL 8+.

```bash
# 1. Server
cd server
npm install
cp .env.example .env          # set DB credentials and a long random JWT_SECRET

# New database:
mysql -u root -p < src/database/schema.sql
# ...or upgrade an existing database (safe to re-run):
npm run migrate

npm run seed:demo             # demo departments, users, exams and results
npm run dev                   # http://localhost:5000

# 2. Client
cd ../client
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :5000)
```

Production: `npm run build && npm start` in `server/`, `npm run build` in `client/`, then serve `client/dist` behind a reverse proxy that forwards `/api` to Node over HTTPS. The server refuses to start in production without `JWT_SECRET`.

### Demo accounts (password `password123`)

| Ro### Demo data

`npm run seed:demo` creates four departments (ICT, Business Development, Human Resources, Finance and Accounts), a super admin, three department admins, 14 candidates and three exams, with a mix of graded, in-progress and not-started attempts so the dashboards and item analysis have data. Completed attempts are graded by the same code as the exam room, and every timestamp is the time the script runs. `npm run seed:demo -- --reset` removes it again.

All demo accounts use the password `Demo@2026`.

| Role | Email |
|---|---|
| Super admin | oluwaseun.adeyemi@demo.pytest.local |
| Department admins | chinedu.okafor@ (ICT), aisha.bello@ (BD), folake.adebayo@ (HR) |
| Candidates | e.g. emeka.nwosu@ (ICT), ngozi.okonkwo@ (BD), adaeze.uche@ (HR) |

All addresses end in `demo.pytest.local`. The older `seed:users` and `seed` scripts are still available for a minimal setup.

urpose |
|---|---|
| `PORT` | API port (default 5000) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Token signing secret (required in production) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CORS_ORIGIN` | Client origin |
| `NODE_ENV` | `development` or `production` |

## Brand palette

Defined in `client/tailwind.config.js`. Primary is a CSS-variable scale generated from the brand colour, so the Branding page can change it at runtime.

| Token | Colour |
|---|---|
| primary | `#1E5269` |
| secondary | `#3B82F6` |
| accent | `#10B981` |
| dark | `#1F2937` |
| light | `#F9FAFB` |

## Question CSV format

```
question,option_a,option_b,option_c,option_d,correct,marks,difficulty,topic
"What is 15% of 240?",32,36,38,30,b,1,easy,Percentages
```

The header row is optional. `correct` is a–d, `marks` defaults to 1, and `difficulty` is easy/medium/hard (default medium). A template can be downloaded from the exam form.

## Project structure

```
server/src/
  index.ts        app setup, middleware order, expired-attempt sweep
  middleware/     auth (JWT + live account check), validation, security headers, rate limit, errors
  routes/         one file per resource, with its Zod schemas
  controllers/    auth, exams, results, users, analytics, departments, settings, activity
  services/       attempt.service.ts (start / autosave / grade), auth.service.ts
  utils/          access scoping, audit logger
  database/       schema.sql, seed scripts
server/migrate.mjs  idempotent schema upgrade
client/src/
  pages/          one component per screen (ExamTakePage is the exam room)
  components/     UI kit, charts, ExamForm, layout
  hooks/          React Query hooks, auth and branding stores
  api/client.ts   typed API client
```

The API routes are defined in `server/src/routes/`, one file per area (auth, users, exams, results, analytics, departments, activity, settings).
