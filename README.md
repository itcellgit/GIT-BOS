# Academic Curriculum Portal

**Syllabus framing and Board of Studies (BOS) approval system for KLS Gogte Institute of Technology, Belagavi.**

Faculty fill in their course syllabus through web forms, following the course-format rules of the active academic scheme. Each syllabus goes through Internal BOS → Industry/Alumni Expert → External BOS → Academic Council review, with every suggestion and the action taken recorded against a numbered version (V1.0 … V4.0 Final). The output is a print-ready PDF laid out like the institution's official templates.

| | |
|---|---|
| **Status** | Phase 0 built; Phase 1 (Theory editor, validation, print layout and PDF) built 15 Oct 2026; Phase 2 review workflow (versions, inputs, stages, unlock, Action Taken report) built 23 Oct 2026 — see §12. Strategy draft v0.5 |
| **Stack** | **PERN**, plain **JavaScript** (no TypeScript): **P**ostgreSQL 17 (Prisma) · **E**xpress 5 · **R**eact 19 (Vite, Tailwind CSS 4, shadcn/ui) · **N**ode.js 24 · Better Auth |
| **Hosting** | Hostinger VPS (Ubuntu 24.04, Docker Compose, Caddy) |
| **Maintained by** | In-house faculty development team |
| **Reference documents** | Word templates and scheme in `F:\GIT-BOS\` (see §1) |

## Getting started (local development)

Requirements: **Node.js 24** and npm. No Docker or PostgreSQL install is needed for development — a real PostgreSQL 17 server runs from `node_modules` (the `embedded-postgres` package).

The repository is an **npm workspace** with three packages: `backend/` (Express API), `frontend/` (React app) and `shared/` (rules and validation used by both). Run every command from the repository root.

```bash
npm install                      # installs all three packages; generates the Prisma client
cp .env.example .env             # then set BETTER_AUTH_SECRET (see the comment in the file)

npm run db:start                 # terminal 1: local PostgreSQL on port 54329 (keep it open)
npm run db:deploy                # terminal 2: create the tables
npm run db:seed                  # 2025 scheme, B.E. CSE semesters III–IV, outcome lists, users
npm run dev                      # API on http://localhost:4000 + React app on http://localhost:5173
```

Open **http://localhost:5173**. In development, Vite forwards every `/api` request to the Express API, so the browser sees a single site, exactly as in production.

**Using VS Code Live Share.** Share frontend port **5173** with guests; the Vite proxy forwards their `/api` requests to the API on port 4000. Development accepts the forwarded hostname or IP for sign-in when it matches the request host.

**Signing in locally.** Everyone can sign in with a one-time code sent by email. Without `SMTP_HOST`, development prints the code in the `npm run dev` terminal (and keeps a copy in `.local/mail.log`). The Super Admin can also sign in with a password (D15). Seeded accounts:

| Email | Role |
|---|---|
| value of `SUPER_ADMIN_EMAIL` | Super Admin (password from `SUPER_ADMIN_PASSWORD`, changed at first sign-in) |
| `it.admin@example.edu` | Administrator |
| `dean@example.edu` | Dean Academics |
| `bos.cse@example.edu` | BoS Coordinator (CSE) + Faculty |
| `hod.cse@example.edu` | Head of Department (CSE) |
| `faculty.cse@example.edu` | Faculty (CSE), assigned to 1BCS304 |

The `@example.edu` demo accounts are created only when `NODE_ENV` is not `production`. With `SMTP_HOST` set, development still never emails reserved test domains such as `example.edu`: those codes are printed and logged as above, so the demo accounts and the end-to-end tests keep working. If the Super Admin password is lost: `npm run super-admin` (resets it to `SUPER_ADMIN_PASSWORD`; a new one must be chosen at the next sign-in).

**Commands** (from the repository root)

| Command | What it does |
|---|---|
| `npm run dev` | API (port 4000, restarts on change) and React app (port 5173, hot reload) together |
| `npm test` | Unit tests (Vitest): scheme rules, permissions, password policy (`shared/`) and API basics (`backend/`) |
| `npm run test:e2e` | End-to-end tests (Playwright); needs `db:start` running and the seed loaded |
| `npm run lint` / `npm run format` | Code quality (ESLint, Prettier) |
| `npm run db:migrate` | After changing `backend/prisma/schema.prisma`: create and apply a migration |
| `npm run db:studio` | Browse the database |
| `npm run db:utf8` | Convert a local database created before UTF-8 was enforced (Windows made it WIN1252); keeps the data and a backup |
| `npm run super-admin` | Create the Super Admin, or reset a lost password |
| `npm run build` | Production build of the React app (`frontend/dist`), served by Express |
| `npm start` | Run the API in production mode (serves `frontend/dist` as well) |

A pre-commit hook (Husky + lint-staged) formats and lints staged files.

**Deployment (Hostinger VPS).** On the server: install Docker, copy `.env.example` to `.env` and fill in the production section (`DOMAIN`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<DOMAIN>`, SMTP, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`), then:

```bash
docker compose build
docker compose run --rm app npm run db:deploy -w backend    # apply migrations (every deploy)
docker compose run --rm app npm run db:seed -w backend      # first install only
docker compose up -d
```

Caddy obtains the HTTPS certificate for `DOMAIN` automatically. Backups: see §10 "VPS set-up".

## Contents

1. [Source documents](#1-source-documents)
2. [Confirmed decisions](#2-confirmed-decisions)
3. [Open questions and working assumptions](#3-open-questions-and-working-assumptions)
4. [Roles and permissions](#4-roles-and-permissions)
5. [Configuration model (two layers)](#5-configuration-model-two-layers)
6. [Data model](#6-data-model-core-entities)
7. [Versioning and workflow](#7-versioning-and-workflow)
8. [Output: HTML print layouts → PDF](#8-output-html-print-layouts--pdf)
9. [Validation rules](#9-validation-rules)
10. [Architecture and technology](#10-architecture-and-technology)
11. [Security and non-functional requirements](#11-security-and-non-functional-requirements)
12. [Phased delivery plan](#12-phased-delivery-plan)
13. [Testing strategy](#13-testing-strategy)
14. [Risks and mitigations](#14-risks-and-mitigations)
15. [AI assistance](#15-ai-assistance)
- [Appendix A — 2025 scheme reference data](#appendix-a--2025-scheme-reference-data-cse-semesters-iiiiv)
- [Appendix B — Sections in each format](#appendix-b--sections-in-each-format)

**Keeping this file current:** this README is the single reference for the implementation. When a decision changes, update §2 (and §3 when an open question is answered) in the same commit as the code.

---

# Implementation Strategy

This section records the decisions taken so far, the architecture, the data model, the workflow rules and the phased delivery plan. Where a question is still open with Dean Academics, it states the **working assumption** used so development is not blocked, and how the design keeps that point configurable.

## 1. Source documents

Reference files (Word) in `F:\GIT-BOS\`, the folder above this project:

| File | Used for |
|---|---|
| `Requirement Analysis for the software to be made.docx` | Functional and non-functional requirements |
| `2025 Syllabus Template- UG Theory.docx` | Fields and print layout reference: Theory (PCC, ASC, BSC) |
| `2025 scheme Syllabus Template- UG Integrated.docx` | Fields and print layout reference: Integrated (IPCC) |
| `2025 Integrated course with Prj based evaluation.docx` | Fields and print layout reference: Integrated, project-based |
| `2025 Lab, AEC Template for UG.docx` | Fields and print layout reference: Lab / AEC (PCCL, AEC) |
| `Action Taken Format.docx` | Fields and print layout reference: Action Taken report, four stages |
| `GIT BE 2025 Scheme 3rd to 4th Semester (1).docx` | Scheme structure and credit ↔ hours rules |

Where these documents conflict with the decisions below, **the decisions below win**.

---

## 2. Confirmed decisions

| # | Decision |
|---|---|
| D1 | **Versioning:** major number = stage milestone (V1 → V2 → V3 → V4 Final); minor number = each revision within a stage (V2.0, V2.1, V2.2…). |
| D2 | **CO–PO/PSO matrix uses tick marks**, not a 1/2/3 strength scale. |
| D3 | **Internal BOS, External BOS and Academic Council inputs are entered by the BoS Coordinator.** These reviewers do not log in. |
| D4 | **Institution-wide**, hosted on the **cloud**. |
| D5 | **The department's BoS Coordinator can unlock a syllabus at any stage**, including after V4. Changes are always incremental: a new minor version, never an edit to an existing version. |
| D6 | **Schemes change over time and are fully configurable.** Nothing scheme-specific is hardcoded. |
| D7 | **Two-layer configuration:** Dean Academics configures institution-level items (scheme, rules, course categories, formats). The BoS Coordinator then configures department-level items under that scheme. |
| D8 | From the 2025 scheme: **14 teaching weeks per semester; total hours = 30 × credits; TW & SL = total − (L + T + P).** These are configuration values, not constants. |
| D9 | **No Word output.** Faculty fill in HTML forms; the output is a printable **PDF** laid out like the Word template for that course format (§8). |
| D10 | **Stack: PERN in plain JavaScript** (§10): PostgreSQL, Express, React, Node.js. No TypeScript; Tailwind CSS for styling. Chosen (15 Oct 2026, replacing the earlier Next.js + TypeScript plan) because the in-house faculty developers who will maintain it work in React, Node.js and JavaScript. |
| D11 | **AI is an optional assistant:** it suggests, a person decides, and every accepted suggestion is recorded. Planned for Phase 2 (§15). |
| D12 | **React single-page app + REST API.** The React app loads data from the Express API (`/api/...`) with React Query and, after any successful change, reloads what is on screen. Every response has the same shape: `{ ok, data, message }` or `{ ok: false, error, fieldErrors }`. |
| D13 | **Faculty assignments are per (scheme, course)**, not per programme row, because one syllabus serves every programme that lists the course (Q1). The BoS Coordinator of the course's **owning** department manages them. |
| D14 | **One repository, three npm workspaces:** `backend/` (Express API), `frontend/` (React app), `shared/` (rules and validation used by both). In production Express serves the built React app, so it deploys as **one container**. Import rules between the folders are enforced by ESLint (§10, "Folder structure"). |
| D15 | **Super Admin:** full access everywhere (still audit-logged); signs in with **email + password** (12+ characters, letters and digits), must replace an initial password at first sign-in, can reset a forgotten password with an emailed code. Only a Super Admin can create or remove another, and the last one cannot be removed or deactivated. After granting the role, a Super Admin sets the colleague's initial password on the Users page (also used to reset a colleague's lost password); the colleague is signed out and must replace it at the next sign-in. Passwords can never be created for any other role. Email and initial password come from `.env` (`SUPER_ADMIN_*`); `npm run super-admin` recovers a lost password. Ordinary users keep one-time email codes. |
| D16 | **One print path:** a print layout is a pure function in `shared/src/print/` that turns the syllabus JSON into a complete HTML document. The browser preview and the server PDF both use it, so they cannot differ. PDFs come from headless Chromium: Gotenberg in production, Playwright's Chromium in development. Standard text blocks use a small, escaped formatting (pipe tables, `-` and `1.` lists, `**bold**`) so Dean Academics can edit the CIE/SEE tables and rubrics without a developer. |

---

## 3. Open questions and working assumptions

These questions are pending with Dean Academics. Build to the assumption, and keep each one configurable or easy to change.

| # | Question | Working assumption | How the design absorbs a different answer |
|---|---|---|---|
| Q1 | Courses taught by another department (e.g. Maths teaching 1BMAT301 for CSE): which BoS reviews it, and is there one shared syllabus? | The **teaching department's** BoS owns the syllabus. One syllabus is shared by every programme that lists the course. | A `Course` has an `owning_department`; programmes reference courses through `SchemeCourse` rows. Changing ownership is a data change, not a code change. |
| Q2 | TW & SL split | Faculty choose the split; **TW + SL must equal the scheme's TW&SL value**. | The validation rule is configurable per category. |
| Q3 | SDC and NCMC syllabi | Not in scope for v1. Categories can be marked "no syllabus required". | Flag on `CourseCategory`. A format can be added later. |
| Q4 | IPCC standard vs project-based format | Set **per category by Dean Academics**, and overridable **per course by the BoS Coordinator** from the allowed formats. | `CourseCategory.allowed_formats[]` plus `SchemeCourse.format`. |
| Q5 | WK / SDG representation; expert link | The WK and SDG columns show the selected codes (e.g. "WK3, WK5", "SDG 4") picked from configured lists (WK1–WK9, SDG 1–17). The expert **does** use a secure link. | The lists are Layer-1 configuration. How the cell is displayed is set in the print layout. |
| Q6 | Sign-in provider | Google Workspace or Microsoft 365 **single sign-on**, with an email-OTP fallback. | Uses a pluggable authentication library, so either provider is a configuration change. |
| Q7 | Which CIE scheme and rubrics apply to 4th-year Theory courses? (The template has a 2nd-year and a 3rd-year variant.) | None is seeded for year 4; the print leaves the CIE section out. | Dean Academics adds a text block for year of study 4 (or makes one apply to all years) on the scheme page. No code change. |

---

## 4. Roles and permissions

| Capability | Dean Academics | BoS Coordinator (per dept) | Course Coordinator (faculty) | HoD / Dean | Expert (link) | Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Create / clone / publish / retire a scheme (Layer 1) | ✔ | | | | | |
| Course categories, formats, rules, text blocks, PO/WK/SDG lists | ✔ | | | | | |
| Department course list, electives, PSOs (Layer 2) | | ✔ | | | | |
| Reviewer directory; assign Course Coordinators | | ✔ | | | | |
| Edit the syllabus working copy | | ✔ | ✔ (own courses) | | | |
| Submit a version | | ✔ | ✔ | | | |
| Record meeting inputs and actions taken | | ✔ | ✔ (action taken only) | | | |
| Advance a stage / mark approved | | ✔ | | | | |
| Unlock at any stage | | ✔ | | | | |
| Issue / revoke expert links | | ✔ | | | | |
| Comment by unit on a shared version | | | | | ✔ | |
| Dashboards and downloads | ✔ (all) | ✔ (dept) | ✔ (own) | ✔ (dept/all) | | |
| Users, departments, system settings | | | | | | ✔ |

**Super Admin** (D15) can do everything in this table, in every department, and is the only role that can create, change or remove another Super Admin. The Administrator manages users and departments but cannot touch Super Admin accounts.

Rules:
- Permissions are **scoped to the department**. A BoS Coordinator acts only on their department's courses, and on another department's courses only if that department owns them (Q1).
- One person can hold several roles (e.g. a faculty member who is also the BoS Coordinator).

---

## 5. Configuration model (two layers)

### Layer 1 — Dean Academics (institution level, per scheme)

- **Scheme:** name ("2025 Scheme"), framework text ("OBE & CBCS"), effective academic year, status.
- **Scheme rules:**
  - teaching weeks per semester (14)
  - hours-per-credit (30)
  - P hours per credit per week (2)
  - Bloom levels and their verb lists
- **Course categories** (PCC, IPCC, PCCL, AEC, ASC, BSC, SDC, NCMC…). For each category:
  - allowed formats (Theory / Integrated / Integrated-Project / Lab)
  - allowed credit patterns, e.g. `3:0:0`, `4:0:0`, `3:0:1`, `0:0:1`
  - CIE marks, SEE marks, whether there is an SEE, whether the course is graded pass/fail (PP)
  - syllabus required? (yes/no)
- **Formats:** each format is an HTML print layout plus a section schema (see §8). Settings per format:
  - section order, sections turned on or off, heading labels
  - number of units (5) and of experiments (12+2 for Lab, 10+3 for Integrated, 10+2 for Project)
  - number of course learning objectives and COs (min/max)
  - whether reference books are included (Lab format has none)
  - label for the prerequisites field ("Pre-requisites" vs "Required Knowledge of")
- **Standard text blocks**, picked by format and year of study: delivery and assessment methods, suggested learning activities, CIE scheme (2nd-year vs 3rd-year variant), SEE scheme, rubrics. Faculty can view these but **not edit** them.
- **Outcome lists:** PO1–PO11, WK1–WK9, SDG 1–17.
- **Branding:** institute name, logos and address, printed on syllabi and Action Taken reports.

### Layer 2 — BoS Coordinator (department level, within a published scheme)

- Programme(s) of the department and their **PSOs** (the count varies per programme).
- **Course list per semester:**
  - code, title, category, teaching department, L/T/P/TW&SL hours, credits, CIE/SEE marks
  - **checked against Layer 1 rules** on save
  - imported from an Excel template or cloned from the previous scheme
- **Elective baskets:** a parent code such as `1BCSL308x` with options A–E. Each option is its own course with its own syllabus.
- **Reviewer directory:** name, category (Internal BOS / External BOS / Industry Expert / Alumnus / AC member), designation, organisation, email.
- **Assignment** of a Course Coordinator (and optional co-authors) to each course.

### Scheme lifecycle

```
Draft ──publish──▶ Published ──retire──▶ Retired (read-only archive)
```

- Syllabi can be created only under a **Published** scheme.
- Changing Layer-1 rules on a Published scheme creates a **Scheme Amendment** record. Every syllabus affected by the change is flagged **"Needs revision"**, and its validation is re-run.
- **Clone scheme:** creates a Draft copy of all Layer-1 configuration. Each department can then clone its Layer-2 course list into it.
- Several schemes stay active at once (e.g. 2022 and 2025 batches). Every syllabus belongs to exactly one scheme.

---

## 6. Data model (core entities)

```
Institution
 └─ Department ─ Programme (PSO list)
Scheme (Layer 1)
 ├─ SchemeRule (key/value: weeks, hours_per_credit, …)
 ├─ CourseCategory (formats[], credit_patterns[], cie, see, has_see, pass_fail, syllabus_required)
 ├─ Format (layout key + layout_version, section schema, section order/labels, counts)
 ├─ TextBlock (format, year_of_study, kind, rich text)
 ├─ OutcomeList (PO / WK / SDG items)
 └─ SchemeAmendment (what changed, when, by whom)
SchemeCourse (Layer 2): scheme, programme, semester, course, category, format, L,T,P,TWSL, credits, cie, see, elective_group
Course: code, title, owning_department
Syllabus: scheme + course (one per course, shared by its programmes), format, status, current_stage, current_version, lock_state, needs_revision
 ├─ WorkingCopy: content JSON (mutable, autosaved) — built as Syllabus.content + Syllabus.revision
 └─ SyllabusVersion: major, minor, label "V2.1", stage, content JSON (IMMUTABLE),
                     created_by, created_at, reason, source (submit | incorporate | unlock)
ReviewMeeting: syllabus or batch of syllabi, stage, date/time, venue, attendees[]
ReviewInput: syllabus, reviewed_version, stage, section_ref (e.g. unit:3, co:2, textbooks),
             input_text, given_by (Reviewer), action_taken, decision (accepted | partly | not accepted),
             resulting_version
Reviewer: directory entry (no login)
ExpertLink: syllabus_version, reviewer, token hash, expires_at, revoked, last_used
AuditLog: every state change, unlock, approval, config change, accepted AI suggestion
AiSuggestion / AiCallLog / AiSettings: see §15.5
GeneratedDocument: version, kind (syllabus | action_taken | compiled_book), pdf, sha256, layout_version, frozen (bool), created_at
```

**Syllabus content** is stored as one JSON document per version, validated against the section schema of its format. Example sections:

```
header (derived from SchemeCourse; read-only)
course_learning_objectives[]
prerequisites
units[5]: {title, content (sanitised HTML: bold/italic/lists), hours}
experiments[]: {unit, no, title, open_ended}
flipped_classroom[]: {unit, sessions, topic?, pre_class?, activity?, hours?, outcome?}
text_books[], reference_books[]: {authors, title, publisher, edition, year, isbn?}
e_resources[]: {title, platform, url, unit, type}
term_work[]: {activity, unit_or_co, deliverable, hours}
self_learning[]: {activity, resources, output, hours}
course_outcomes[]: {no, statement, action_verb, level, pos[], psos[]}
mapping: {co_no: {po: [..], pso: [..], wk: [..], sdg: [..]}}
text_block_refs: {cie_scheme, see_scheme, rubrics, delivery, assessment}
```

Why JSON snapshots:
- each version is a complete, self-contained record, which supports audit and recovery
- section-level comparison between any two versions is easy
- the same data feeds the web form, the preview and the print layout

---

## 7. Versioning and workflow

### Stage state machine

```
          submit                close stage (BoS Coord.)
 DRAFT ─────────▶ V1.0 ─▶ INTERNAL BOS ─▶ incorporate ─▶ V2.0
                                                          │ share link
                                                          ▼
                       V2.n ◀─ incorporate ◀─ EXPERT REVIEW (one or more experts)
                        │
                        ▼
                  EXTERNAL BOS ─▶ incorporate ─▶ V3.0 ─▶ ACADEMIC COUNCIL ─▶ incorporate ─▶ V4.0 APPROVED
```

| Event | Resulting version |
|---|---|
| First submission by faculty | V1.0 |
| Edits after submission but before Internal BOS | V1.1, V1.2… |
| Internal BOS stage closed with inputs incorporated | **V2.0** |
| Each expert's inputs incorporated | V2.1, V2.2… |
| External BOS stage closed | **V3.0** |
| Academic Council stage closed and approval recorded | **V4.0 (Final)** |
| Unlock and correction at any stage | next minor version of the current major (e.g. V4.1) |

### Rules

1. **Versions are immutable.** All editing happens in the working copy. Each "commit" creates a new version.
2. **Every input is recorded against the version it reviewed and the section it refers to.** When the input is incorporated, its `resulting_version` is filled in.
3. **A stage cannot be closed while inputs are still pending.** Each input must have an action taken and a decision.
4. **Approval is separate from review completion.** V4.0 is marked *Approved* only when the BoS Coordinator records the Academic Council decision (meeting date and reference).
5. **Unlock:**
   - requires a reason
   - is logged and shows as an entry in the Action Taken report
   - moves the syllabus to *Revising*, and the next commit creates the next minor version
   - when a V4.x syllabus is unlocked, the latest approved version stays the **official** one until the correction is committed and approved again
6. **Expert links:**
   - one link per expert per version, issued by the BoS Coordinator
   - time-limited and revocable; only the token's hash is stored
   - the expert sees the version read-only, with a comment box against each unit and section
   - each comment becomes a `ReviewInput` with stage *Expert*
7. **Batch meetings:** one `ReviewMeeting` can cover many syllabi (a BOS meeting reviews a whole semester). Inputs are then entered course by course.

### Action Taken report

Generated per syllabus per stage, using the four headings from `Action Taken Format.docx`: Post Internal BOS, Post Industry Experts & Alumni, Post External BOS, Post Academic Council.

Each row shows:
- S.No
- Input
- Inputs given by: name, category, designation and organisation
- Action Taken

The header carries the semester, meeting date and time, venue, and course name and code. Unlock entries appear as extra rows with the reason given.

---

## 8. Output: HTML print layouts → PDF

**Decision D9:** the portal does **not** produce Word files. Faculty fill in HTML forms. The output is a **printable PDF** whose layout matches the Word template for that course format. The Word files in the project folder are the **visual reference** for the layouts, not inputs to the system.

- **One rendering path:** syllabus JSON → HTML print template (per format) → PDF.
  - The same HTML is used for the on-screen preview, so **what faculty see is what prints**.
  - It is also used as the read-only "meeting view" projected in BOS meetings.
- **Print layouts are written once per format** in HTML with print CSS (`@page`):
  - Theory, Integrated, Integrated-Project, Lab/AEC, Action Taken report, compiled-book cover and contents
  - each one rebuilt to match its Word reference: A4 size, margins, bordered tables, bold headings
  - subject title in ALL CAPS, bold, 14 pt
- **Font:** Calibri is a licensed Microsoft font and cannot be installed on a Linux server. Use **Carlito**, an open-source font with the same letter widths as Calibri, so line breaks and the look match the Word reference.
- **Layout settings Dean Academics can change without a developer** (Layer 1, per format):
  - section order, and turning a section on or off
  - section heading labels (e.g. "Pre-requisites" vs "Required Knowledge of")
  - standard text blocks (CIE/SEE schemes, rubrics, delivery methods)
  - number of units, experiments and COs
  - institute header and logo
- **Structural layout changes** (a new table shape, a new kind of section) are made by a developer in the HTML template. The template is versioned (`layout_version`).
- **Print features:**
  - running header or footer showing course code, version label and status (e.g. "V2.1 – Under Expert Review")
  - "Page X of Y"
  - a **DRAFT watermark** on anything not approved
  - table header rows repeated when a table continues onto the next page
  - no table rows split across pages
  - signature block at the end
- **Outputs:**
  - Syllabus PDF
  - Action Taken report PDF, per stage
  - **Compiled syllabus book** per programme, semester or scheme: cover, scheme table, a clickable table of contents with PDF bookmarks, then the approved syllabi in order
- **Approved versions are frozen:** when V4.x is approved, its PDF is generated once and stored with a checksum, along with the `layout_version` used. If the layout is redesigned later, approved documents still reprint exactly as they were approved. Drafts are rendered on demand.
- **Optional:** a QR code on approved PDFs linking to a verification page, which confirms the printed copy is the official approved version.
- **Optional Word copy:** if someone needs an editable copy, an approximate .docx can be added later from the same HTML. It is not a v1 requirement.

---

## 9. Validation rules

All numbers come from configuration (§5), never from constants.

| Rule | Check |
|---|---|
| Header consistency | L + T + P + TW&SL = hours_per_credit × credits (except pass/fail categories) |
| Credit pattern | Credit L:T:P is in the category's allowed patterns. Hours/week = L credit, T credit, and P credit × 2 |
| Unit hours | Σ unit hours = scheme L hours (e.g. 42 or 56) |
| Experiment hours | Σ experiment hours = scheme P hours (e.g. 14 × 2 = 28) |
| TW + SL | Σ TW hours + Σ SL hours = scheme TW&SL value (Q2) |
| Flipped classes | Σ flipped hours/sessions = header value |
| Counts | Exactly N units and experiments for the format; CLOs and COs within min/max |
| COs | Each CO has an action verb from the configured Bloom list; level is set; at least one PO ticked |
| Coverage (warning) | Every unit is referenced by at least one CO; every CO appears in the matrix |
| Books | Required fields present; at least one textbook |
| E-resources | Valid URL format; optional link check before generation |
| Mandatory fields | Must all be present before **submit**. Drafts can be saved incomplete. |

Each rule is either an **error** (blocks submission) or a **warning** (shown in the review screen).

---

## 10. Architecture and technology

**Decision D10:** **PERN stack in plain JavaScript**: **P**ostgreSQL · **E**xpress · **R**eact · **N**ode.js, with Tailwind CSS. No TypeScript. The software will be built and maintained by in-house faculty developers who work in React, Node.js and JavaScript.
**Hosting:** a Hostinger VPS, self-managed, running Docker Compose.

| Layer | Choice | Reason |
|---|---|---|
| Language | **JavaScript (ES modules)** everywhere; JSDoc comments where a shape needs explaining | The team's language; no build step on the server |
| Runtime | **Node.js 24 LTS** | Runs the API, the scripts and the tooling |
| Database | **PostgreSQL 17**, in a container, not exposed publicly | See "Why PostgreSQL" below |
| ORM / migrations | **Prisma 7** (JavaScript client `prisma-client-js`, PostgreSQL driver adapter) | Readable queries, versioned migrations, good documentation for a team maintaining the code long-term |
| API | **Express 5** REST API under `/api`, **Helmet** security headers, **Multer** for Excel uploads | Small, well known, easy to read |
| Frontend | **React 19** single-page app built with **Vite**, **React Router 7** | Fast development server with hot reload; static build served by Express |
| Styling | **Tailwind CSS 4** + **shadcn/ui** components (Radix based, JavaScript) | Accessible ready-made components (dialogs, tabs, selects, tables) whose code lives in the project |
| Data loading | **TanStack React Query** | Caching and reloading of API data with very little code |
| Forms and validation | **React Hook Form + Zod** | **One Zod schema per form is used in the browser and again by the API.** Validation rules are written once |
| Authentication | **Better Auth** (Express handler): email one-time codes; email + password for Super Admins (D15); optional Google / Microsoft SSO; sessions stored in PostgreSQL | Q6; self-hosted, no outside auth service |
| Authorisation | One `can(user, action, resource)` function in `shared/`, with department scoping. The API checks it on every request; the React app uses the same function only to show or hide buttons | Permissions live in one place |
| HTML → PDF | **Gotenberg 8** (headless Chromium behind an HTTP API) in production; Playwright's Chromium in development. Both receive the HTML from `shared/src/print/` with the fonts embedded | Recent Chromium supports `@page` sizes, margins and margin boxes for running headers and "Page X of Y" |
| Print font | **Carlito** (matches Calibri's letter widths) | Calibri cannot legally be installed on Linux |
| Background jobs (Phase 1+) | **pg-boss** (job queue stored in PostgreSQL) | Compiled books, link checks, emails, with **no Redis to run** |
| Excel import/export | **ExcelJS** | Scheme and course-list import |
| Email | **Nodemailer** through institutional SMTP or Brevo / SES | Sign-in codes, password reset, notifications |
| Testing | **Vitest** (rules, permissions, password policy), **Supertest** (API), **Playwright** (end-to-end in a real browser) | Covers rules, API and screens |
| Code quality | ESLint (with folder-boundary rules), Prettier, Husky + lint-staged pre-commit hook | Consistent code across several faculty developers |
| Web server | **Caddy 2** (automatic HTTPS) → the Express app | Simplest reliable TLS set-up |
| Monitoring | **Sentry** (free tier) + **Uptime Kuma** | Errors and downtime alerts |
| Code and CI/CD | Private GitHub repository + **GitHub Actions** (format → lint → unit tests → build → end-to-end tests) | Repeatable deploys |
| AI assistance (Phase 2) | **Vercel AI SDK** + Anthropic provider, called from the API; models set in configuration | Structured output validated with the existing Zod schemas (§15) |

### Why PostgreSQL (not MongoDB)

- **Most of the data is relational.**
  - Scheme → category → scheme-course → syllabus → version → review input → reviewer
  - departments, roles and assignments
  - These need foreign keys and unique constraints (e.g. only one `V2.1` per syllabus), which PostgreSQL enforces itself. In MongoDB they would have to be enforced in application code.
- **Stage transitions must be atomic.** Closing a stage creates a version, updates the input records, changes the syllabus state and writes the audit log, all at once or not at all. PostgreSQL transactions handle this natively.
- **The flexible part is covered too.** Syllabus content is stored as **JSONB**, which gives MongoDB-style documents exactly where they are useful.
- **Dashboards and reports** (status per department and semester, pending inputs, CO–PO coverage) are simple SQL joins.

### Folder structure: backend, frontend, shared

One repository with three **npm workspaces**. **Decision D14.**

```
academic-curriculum-portal/
├─ package.json            workspace root: npm run dev / test / lint / build
├─ backend/                EXPRESS API (Node.js)
│  ├─ prisma/              schema.prisma, migrations/, seed.js, super-admin.js
│  ├─ scripts/             dev-db.js (local PostgreSQL), super-admin.js (create / recover Super Admin)
│  └─ src/
│     ├─ server.js         starts the API (port 4000)
│     ├─ app.js            Express app: security headers, /api/auth (Better Auth), routes,
│     │                    and in production the built React app
│     ├─ routes/           one file per area: me.js (me, home, account), admin.js, schemes.js,
│     │                    course-lists.js, departments.js
│     ├─ services/         queries and business operations: schemes, courses, Excel, audit log
│     ├─ auth/             auth.js (Better Auth config), session.js (current user, permission checks)
│     ├─ http/handler.js   handle(): validates the body with Zod and sends { ok, data, message }
│     │                    or { ok: false, error, fieldErrors } — the same shape for every endpoint
│     ├─ infra/            db.js (Prisma client), mail.js
│     ├─ config/           load-env.js (reads the repository-root .env)
│     ├─ errors.js         UserError (400), PermissionError (401/403), NotFoundError (404)
│     └─ generated/        Prisma client (generated; not committed)
│
├─ frontend/               REACT APP (Vite + Tailwind CSS)
│  ├─ index.html, vite.config.js   dev server on port 5173; forwards /api to the API
│  └─ src/
│     ├─ main.jsx, App.jsx  entry point and the route table
│     ├─ pages/            one file per screen: login, home, account, schemes, scheme,
│     │                    course list, department, admin users, admin departments
│     ├─ components/
│     │  ├─ ui/            shadcn/ui building blocks (button, table, dialog…)
│     │  ├─ forms/         generic form dialog, confirm button, course-rules helper, Excel import
│     │  ├─ layout/        portal layout, sign-in guard, page header, loading / error states
│     │  ├─ auth/          sign-in form, change-password form
│     │  └─ schemes/       scheme page tabs (categories, formats, outcomes, Bloom, text, programmes)
│     ├─ lib/              api.js (fetch wrapper), actions.js (one function per change the UI
│     │                    can make), auth-client.js, utils.js
│     └─ hooks/            use-api.js (React Query helpers: useApiQuery, useMe, useRefreshAll)
│
├─ shared/                 USED BY BOTH; pure JavaScript, no database, no React
│  └─ src/
│     ├─ domain/           business rules + unit tests: credit/hour rules, permissions (can())
│     │                    syllabi/ (content, validation), reviews/ (workflow, compare)
│     ├─ schemas/          Zod validation schemas (forms and API), password policy
│     ├─ print/            print layouts: syllabus JSON → complete HTML document (preview and PDF),
│     │                    rich-text.js for standard text blocks (tables, lists, bold)
│     ├─ data/             2025 scheme reference data (seed and tests)
│     └─ labels.js         display names for enum values
│
├─ e2e/                    Playwright end-to-end tests
├─ deploy/Caddyfile        HTTPS reverse proxy
└─ Dockerfile, docker-compose.yml
```

**Rules** (enforced by ESLint; a wrong import fails `npm run lint` and the pre-commit hook):

| Package | May import | Must not import |
|---|---|---|
| `frontend/` | `@acp/shared/...`; talks to the backend **only through the API** (`src/lib/api.js`, `src/lib/actions.js`) | anything from `backend/` |
| `backend/` | `@acp/shared/...` | anything from `frontend/` |
| `shared/` | packages only (Zod) | `frontend/`, `backend/` |

How a screen works, end to end:
1. A **page** in `frontend/src/pages/` loads its data with `useApiQuery("/schemes/…")`, which calls `GET /api/schemes/…`.
2. The **route** in `backend/src/routes/` checks the signed-in user's permission (`assertPermission`), loads data through `services/` and returns `{ ok: true, data }`.
3. A **form** calls a function from `frontend/src/lib/actions.js` (e.g. `saveCategory`), which sends `POST`/`PUT`/`DELETE` to the API.
4. The route validates the body with the **same Zod schema** the form used, applies the `shared/domain` rules, writes through Prisma **inside a transaction together with the audit-log entry**, and replies `{ ok: true, message }` — or `{ ok: false, error, fieldErrors }`, which the form shows next to the fields.
5. After a successful change the app reloads the data on screen.

**Why rules live in `shared/domain`:** the same rule runs twice. It runs in the browser for instant feedback (e.g. "Lecture hours should be 42") and again in the API before saving. Keeping it in one pure, unit-tested place means the two can never disagree. It also keeps the rules independent of Express and React, so library upgrades are safe as faculty developers change over the years.

### API overview

All endpoints are under `/api` and return JSON (`{ ok, data, message }` or `{ ok: false, error, fieldErrors, code }`).

| Area | Endpoints |
|---|---|
| Sign-in (Better Auth) | `/api/auth/*` — email code, password, sign-out, password reset code |
| Me | `GET /me`, `GET /home`, `GET /auth-options`, `POST /account/change-password`, `POST /account/reset-password` |
| Administration | `GET /admin/users`, `POST /admin/users`, `PUT /admin/users/:id`, `POST /admin/users/:id/roles`, `DELETE /admin/roles/:id`, `GET/POST /admin/departments`, `PUT /admin/departments/:id`, `POST /admin/programmes`, `PUT /admin/programmes/:id` |
| Schemes (Layer 1) | `GET/POST /schemes`, `GET/PUT/DELETE /schemes/:id`, `POST /schemes/:id/publish`, `POST /schemes/:id/retire`; categories, credit patterns, formats, outcomes, Bloom levels and text blocks under `/schemes/:id/...` |
| Course lists (Layer 2) | `GET /schemes/:sid/programmes/:pid`, `/courses`, `/elective-groups`, `/psos`, `GET /workbook` (Excel), `POST /import` (Excel upload) |
| Departments | `GET /departments/:code`, `/reviewers`, `/schemes/:sid/courses/:cid/assignments`, `DELETE /assignments/:id` |
| Syllabi (Phase 1) | `GET /syllabi/:schemeId/:courseId` (editor data, working copy and `validation` issues), `PUT /syllabi/:schemeId/:courseId` (autosave with `revision`; 409 on conflict), `GET /syllabi/:schemeId/:courseId/pdf` (saved copy as PDF; `?download=1` for an attachment) |
| Review workflow (Phase 2) | under `/syllabi/:schemeId/:courseId`: `GET /review` (versions, inputs, meetings, reviewers, unlocks, approvals); `POST /submit`, `POST /versions` (save version), `POST /close` (close stage; Academic Council needs `approvedOn` + `reference`), `POST /unlock`, `POST /approve`; `GET /versions/:id`, `GET /versions/:id/pdf`; `POST/PUT/DELETE /inputs/:id`, `PUT /inputs/:id/action`; `GET /action-taken/:stage/pdf`. Meetings: `POST/PUT /departments/:code/meetings/:id` |
| Print assets | `GET /print/fonts/:file` (Carlito, for the on-screen preview) |

### VPS set-up

- **Plan:** Hostinger **KVM 2** (2 vCPU, 8 GB RAM, NVMe) minimum; Chromium (inside Gotenberg, from Phase 1) needs memory while rendering. **KVM 4** once every department is using it.
- **OS:** Ubuntu 24.04 LTS.
- **Services (docker-compose):** `caddy`, `app` (Express API + built React app, one image), `db` (PostgreSQL 17), `gotenberg` (HTML → PDF, 1 GB memory limit). Later: `worker` (pg-boss, same image).
  - `db` (and later `gotenberg`) are reachable only on the internal Docker network.
  - Print pages used by Gotenberg accept only internal requests carrying a signed token.
- **Staging:** a separate compose project on the same VPS, e.g. `staging.<domain>`, with its own database.
- **Hardening:**
  - firewall (ufw) open only on 22, 80 and 443
  - SSH keys only, root login disabled
  - fail2ban and unattended security updates
  - sign-in rate limits are active in production (Better Auth)
- **Backups:**
  - nightly `pg_dump` plus the files volume, compressed and copied **off the VPS** with rclone (Backblaze B2 or the institute's Google Drive)
  - kept 30 days daily, then 12 monthly
  - Hostinger weekly snapshots as a second layer
  - **test a restore every month**
- **Domain:** a subdomain on the institute's domain, e.g. `syllabus.<institute-domain>`, with a DNS A record from institute IT. Set `BETTER_AUTH_URL=https://<that domain>`.

### Content editing note
Unit content uses a restricted rich-text editor (e.g. Tiptap) that allows only bold, italic and bullet or numbered lists. It is cleaned on save, so nothing pasted from Word or a web page can break the print layout.

### Alternative stacks considered

| Stack | Fit | Why not chosen |
|---|---|---|
| Next.js + TypeScript (the first plan; Phase 0 was first built on it) | One framework for UI and server; types | The team prefers plain JavaScript and a clear Express/React split; replaced by PERN on 15 Oct 2026 (the earlier code is kept in `F:\GIT-BOS\backups\`) |
| Django + HTMX + WeasyPrint | Built-in admin and permissions; lightest PDF engine | Team does not work in Python |
| Laravel + Livewire + Filament | Polished admin screens | Team does not work in PHP |
| Frappe Framework | Built-in workflow, change history and print formats | Opinionated; strict V-numbered versions go against its defaults; Python |
| MongoDB instead of PostgreSQL | Flexible documents | Data is mainly relational and needs transactions; PostgreSQL JSONB already gives document flexibility |

---

## 11. Security and non-functional requirements

- Role- and department-scoped permissions are checked by the API on every request (`assertPermission` in `backend/src/auth/session.js`); the React app only hides buttons.
- Sign-in: accounts are created only by the Administrator (no self sign-up). Ordinary users sign in with one-time email codes; Super Admins also with a password (12+ characters, letters and digits, replaced at first sign-in). Passwords are hashed by Better Auth; a password can never be created for any role other than Super Admin. Sign-in endpoints are rate-limited in production.
- Session cookies are HTTP-only and same-site; the React app and API share one origin (Vite proxy in development, Express in production), so no cross-origin access is opened.
- Security headers (Content-Security-Policy, X-Content-Type-Options, frame protection) from Helmet and Caddy; HSTS from Caddy.
- Expert tokens: random 256-bit value with only its hash stored, an expiry date, the ability to revoke, request limits, and read-only access to one version.
- Every state change, unlock, approval and configuration change goes to the **append-only audit log**.
- HTTPS only; secrets kept in environment variables or a secrets manager; least-privilege database user.
- Personal data is limited to names, designations and email addresses of staff and reviewers.
- AI calls are made from the server only. Reviewers' contact details are never sent to the AI provider (§15.3).
- Usability:
  - autosave of the working copy
  - clear validation messages next to the field concerned
  - forms work on a laptop and are readable on a tablet
- Accessibility: semantic HTML, keyboard-usable forms, sufficient contrast.

---

## 12. Phased delivery plan

Each phase ends with a demo to the BoS Coordinator or Dean Academics and a short acceptance check.

### Phase 0 — Foundations and configuration ✅ built 15 Oct 2026

**Status:** built and tested locally on the PERN stack (moved from Next.js + TypeScript on 15 Oct 2026):
- **76 unit tests:** every 2025 CSE course passes the rule engine; permissions (including Super Admin); password policy; API basics (sign-in checks, validation format, 404/400 handling, security headers).
- **20 end-to-end tests** in a real browser:
  - sign-in and access by role; an unregistered email cannot sign in
  - Dean creates a scheme by copying 2025, then deletes it
  - Administrator adds a user and roles; cannot create or change Super Admins
  - BoS Coordinator adds a course with the rule helper; wrong hours are rejected
  - Excel import refuses a file containing an invalid row and accepts a valid one
  - faculty assignment; HoD has read-only access
  - Super Admin: forced password change at first sign-in, password sign-in, full access, reset with an emailed code; nobody else can get a password
  - Super Admin makes another Super Admin and sets their initial password, which must be changed at first sign-in
  - Phase 1 editor: faculty frame a Theory syllabus with autosave; the HoD has read-only access; simultaneous edits raise a conflict instead of overwriting
- The production build (Express serving the React app) was checked in a browser: no console or Content-Security-Policy errors.

**Not done yet:**
- VPS deployment: the Docker files are written but untested, because Docker is not installed on the development machine.
- Real SMTP and SSO credentials.
- Running CI on GitHub: there is no remote repository yet.

**Built:**
- Project set-up: npm workspaces (`backend/` Express, `frontend/` React + Vite + Tailwind, `shared/`), Prisma, Docker Compose, CI
- Authentication (Better Auth): email codes for everyone; Super Admin with password (D15); roles and department scoping (`can()`)
- Reusable **"table + form driven by a Zod schema"** pattern for configuration screens
- Prisma seed with the 2025 scheme and the CSE semester III–IV courses
- Layer 1 configuration: scheme, rules, categories, formats, text blocks, outcome lists
- Layer 2: programmes, PSOs, reviewer directory, course list with **Excel import/export**, assigning faculty
- **Accept when:** the 2025 scheme for CSE semesters 3–4 is entered, every course passes rule validation, and faculty are assigned.

### Phase 1 — Theory syllabus authoring and PDF output
- Working copy editor for the Theory format: all sections, the tick matrix, autosave — **✅ built 15 Oct 2026**
  - opened from *My courses* (Home) or the department's course list: `/syllabi/:schemeId/:courseId`
  - one `Syllabus` row per (scheme, course) holds the working copy as JSON (`content`) with a `revision` number; the first save creates it
  - autosave 1.5 s after typing stops; a save based on an old revision is refused (409) and the editor offers the saved copy, so two editors never overwrite each other silently
  - edit: assigned faculty and the owning department's BoS Coordinator; read-only: HoD and Dean Academics (`syllabus.edit` / `syllabus.view` in `can()`)
  - header from the scheme course row (read-only); live totals for unit hours (vs. L hours) and TW + SL (vs. the scheme's TW & SL)
  - PSO ticks are stored per programme, because one syllabus serves every programme listing the course (D13)
  - unit content is plain text for now; standard text blocks are shown read-only (formatted)
- Validation engine (§9) — **✅ built 15 Oct 2026**
  - `shared/src/domain/syllabi/validate.js`: header consistency, objective and CO counts, pre-requisites, units (fields, unit hours = L hours), flipped sessions ≤ unit hours, books and e-resource links, TW + SL = scheme TW & SL, CO level and Bloom verb, at least one PO per CO; warnings for a verb missing from the statement, a CO with no PSO, no flipped sessions, a book with no edition or year
  - runs live in the editor ("Checks" panel, counts in the section list) and in the API (`validation` in `GET /syllabi/...`); Phase 2 refuses submission while errors remain
  - not yet: "every unit is referenced by a CO" (the content has no CO ↔ unit link yet)
- Theory print layout with live preview and PDF download — **✅ built 15 Oct 2026**
  - `shared/src/print/theory-layout.js` builds one self-contained HTML document from the syllabus JSON, section by section as in the Word template; the preview page (`/syllabi/:schemeId/:courseId/preview`) shows it in an iframe and the API turns the same HTML into the PDF
  - A4, Carlito, running header (course code, scheme, status), "Page X of Y", DRAFT watermark, table headings repeated across pages, signature block with the assigned faculty
  - CIE scheme and rubrics are picked by year of study (2nd vs 3rd year); the 2025 Theory CIE/SEE/rubric text is seeded as text blocks (`npm run db:seed` adds missing blocks to existing databases)
- **Accept when:** a faculty member produces a Theory syllabus PDF that, printed side by side with the Word reference, matches it section for section, and the header data comes from the scheme.

### Phase 2 — Versions and the BOS review workflow — **✅ workflow built 23 Oct 2026** (AI, Phase 2A, not started)
- Submit (V1.0), immutable versions, comparison between versions — **✅**
  - `shared/src/domain/reviews/workflow.js`: version numbering, stage order and the guard for every action (`workflowBlocker`), used by the API and to enable buttons; `compare.js`: section-by-section line diff
  - `SyllabusVersion` rows are never updated or deleted: a PostgreSQL trigger refuses it
  - submitting, saving a version and closing a stage are refused while the checks report errors
- Review meetings, inputs by section, action taken, closing stages (V2.0 / V3.0 / V4.0), approval record — **✅**
  - meetings: department page → *Meetings* (stage, date and time, venue, reviewers present); one meeting serves many syllabi
  - inputs: syllabus → *Inputs, versions & Action Taken*; recorded by the BoS Coordinator against the latest version and a section (unit, CO, books…); the Course Coordinator records the action taken and a decision (accepted / partly / not accepted)
  - during a stage the working copy stays editable to incorporate inputs; *Save version* creates the next minor version and records answered inputs as incorporated in it
  - closing Internal BOS → V2.0, closing the expert stage → V2.n only if there are uncommitted changes, External BOS → V3.0; closing the Academic Council stage takes the meeting date and reference and creates V4.0 *Approved* in one step (working assumption for rule 4: the approval is recorded when the stage closes)
- Unlock with reason; minor versions — **✅** only an approved syllabus is locked, so *Unlock* applies after approval; the correction is saved as V4.1 and *Record approval* makes it official (V4.0 stays official until then)
- **Action Taken report** generation — **✅** `shared/src/print/action-taken-layout.js`, one report per stage with the four headings, preview and PDF; unlocks appear as extra rows
- Tests: workflow and print unit tests; `e2e/review-workflow.spec.js` runs V1.0 → V4.0 → unlock → V4.1 in the browser (each run adds its own "E2E workflow test course" in semester 8, because versions cannot be deleted)
- **Not yet:** expert links (Phase 3); notifications by email; a check of the Action Taken layout against `Action Taken Format.docx` (not available on the development machine)
- **Accept when:** one syllabus goes V1.0 → V4.0 with inputs at every stage and correct Action Taken reports, and an unlock produces V4.1.

### Phase 2A — AI assistance (built alongside Phase 2; see §15)
Build the workflow first, then add AI on top of it in this order:
1. AI foundation: `backend/src/ai/`, AiSettings / AiSuggestion / AiCallLog, department caps, Accept / Edit / Reject interface
2. **AI-1 CO quality check** and **AI-2 alignment check** (use the syllabi produced in Phase 1)
3. **AI-8 meeting notes → structured inputs**
4. **AI-9 Action Taken drafts** and **AI-10 change summary**
5. AI-3 CO drafting, AI-4 CO–PO suggestions, AI-5 content tidy-up, AI-6 activity ideas
- Later phases: AI-7 reference help with the link checker (Phase 3); AI-11 department checks and AI-12 quality report with the dashboards (Phase 4); AI-13 help assistant and **AI-14 Word import** before rollout (Phase 5)
- **Accept when:**
  - a coordinator turns real BOS meeting notes into correct inputs and saves them after review
  - Action Taken drafts need only minor edits
  - AI-1 flags the known weak COs in the test set
  - with AI turned off, the whole workflow still works

### Phase 3 — Expert link and remaining formats
- Expert links (issue, expire, revoke) with comments by unit
- Integrated, Integrated-Project and Lab/AEC formats (schemas, forms, print layouts)
- Frozen PDFs for approved versions; optional verification QR code
- **Accept when:** an external expert comments through the link, and one course of each format produces a correct PDF.

### Phase 4 — Programme level and scheme change
- Dashboards: status by department, programme and semester
- Compiled syllabus book
- Scheme clone, carrying old syllabi forward into a new scheme, amendments with "needs revision" flags
- **Accept when:** a cloned "test 2028" scheme is published and a 2025 syllabus is carried forward into it as V1.0.

### Phase 5 — Pilot and rollout
- **Pilot with CSE** for one full review cycle; fix issues; train BoS Coordinators
- Department-by-department rollout; optional one-time import of existing syllabi
- AI-13 help assistant and AI-14 Word import (§15)
- Optional extras: export of CO data for attainment tools

---

## 13. Testing strategy

- **Unit tests (Vitest, `shared/`):** validation rules (driven by the 2025 scheme table), version numbering, stage-transition guards, permission checks, password policy.
- **API tests (Vitest + Supertest, `backend/`):** sign-in checks, response format, validation errors, security headers.
- **End-to-end tests (Playwright, `e2e/`):** every screen and role in a real browser against the dev servers and the seeded database (§12 Phase 0 lists the current ones).
- **Print-layout tests:** render each format from fixed sample JSON and compare the resulting PDF pages with stored reference images, so any unintended layout change fails the test. Check by eye against the Word reference before each release.
- **Workflow tests:** the full path V1.0 → V4.0 → unlock → V4.1, plus negative cases (closing a stage with pending inputs, a faculty member trying to approve, an expired expert link).
- **Configuration tests:** cloning a scheme, amendments flagging the right syllabi, Excel import with bad rows.
- **AI evaluation sets:** a fixed set of real 2025 syllabi and sample meeting notes, each with the expected results, e.g. known weak COs, correctly split inputs, expected PO ticks. Run on every prompt or model change. Unit tests check that every AI output passes its Zod schema and that the portal works with AI turned off.
- **User acceptance:** checklist from §18 of the requirement analysis, run with the pilot department.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Print layout drifts from the official Word reference | Carlito font, print-layout tests, sign-off by Dean Academics for each layout, frozen PDFs for approved versions (§8) |
| Format changes need a developer | Section order, labels, text blocks and counts are configurable; only structural changes need code |
| Rules change mid-cycle | Scheme amendments with "needs revision" flags; nothing hardcoded |
| Faculty adoption | Autosave, carry-forward from previous syllabi, minimal mandatory fields while in draft, short training |
| Open questions answered differently | Assumptions are isolated in configuration (§3) |
| Data loss | Immutable versions, nightly off-VPS backups, Hostinger snapshots, monthly restore test, audit log |
| Developer turnover in the in-house team | Business rules kept in `shared/domain/` with unit tests, one response format for every API endpoint, ESLint folder rules, JSDoc on shapes that need explaining, this README kept up to date, decisions logged in §2 |
| No TypeScript: shape mistakes found later | Zod validates every API input; end-to-end tests cover every screen; lint and tests run in CI and the pre-commit hook |
| Frequent library upgrades (React, Express, Prisma, Better Auth) | Lock dependency versions (package-lock); upgrade on staging first; business rules kept free of libraries in `shared/domain/` |
| Chromium memory use on the VPS | Gotenberg in its own container with a memory limit; compiled books generated as background jobs; KVM 2 minimum |
| Scope creep (attainment, timetable, etc.) | Out of scope for v1; keep the data exportable instead |
| AI makes up books, URLs or ISBNs | References checked against real sources (Open Library / Google Books, NPTEL catalogue, link checker); AI never writes directly into a version (§15) |
| AI cost overrun or API outage | Monthly cap per department, feature-level on/off switches, portal fully usable with AI turned off (§15) |

---

## 15. AI assistance

**Decision D11:** AI is an **optional assistant**. It suggests; a person accepts, edits or rejects; the system records which. Statutory approval stays with the BOS and Academic Council, and faculty remain the authors of every syllabus. Planned for **Phase 2** (see §12).

### 15.1 Principles

1. **Suggest only.** AI output never goes directly into the working copy or a version. Each suggestion is shown beside the field with *Accept / Edit / Reject*.
2. **Traceable.** Each accepted suggestion is recorded in the audit log as "AI-assisted, accepted by \<user\>" against the section and version.
3. **Rules first.** Anything a fixed rule can check (hour totals, credit patterns, the Bloom verb list, counts) stays a rule-based check (§9). AI is used only where language understanding is needed.
4. **Checked against real sources.** Books, ISBNs, editions and URLs suggested by AI are verified (Open Library / Google Books for books, the NPTEL/SWAYAM catalogue, the link checker) before they are shown. Anything that cannot be verified is marked "unverified".
5. **Optional.** The portal works fully with AI turned off. Dean Academics can turn AI on or off globally and per feature.
6. **No automated decisions.** AI never closes a stage, approves a version, or decides whether an input is accepted.

### 15.2 Features

**For faculty (Course Coordinators)**

| # | Feature | What it does |
|---|---|---|
| AI-1 | **CO quality check** | Flags verbs that can't be measured ("understand", "know", "learn"), suggests the Bloom level, and proposes better wording |
| AI-2 | **Alignment check** | Finds gaps: units not covered by any CO, COs with no supporting unit content, course objectives that don't match the COs |
| AI-3 | **CO drafting** | Suggests 4–5 measurable COs from the unit content |
| AI-4 | **CO–PO/PSO tick suggestions** | Suggests ticks with a one-line reason for each; the faculty member confirms |
| AI-5 | **Unit content tidy-up** | Turns pasted, messy text into topics and sub-topics; suggests how to split the hours |
| AI-6 | **Activity ideas** | Suggests flipped-class topics and TW/SL activities matched to the units |
| AI-7 | **Reference help** | Formats books consistently; suggests NPTEL/SWAYAM courses, **from the verified catalogue only** |

**For BoS Coordinators**

| # | Feature | What it does |
|---|---|---|
| AI-8 | **Meeting notes → structured inputs** | Coordinator pastes the BOS meeting notes (or a transcript). The AI splits them into separate inputs per course and section, with who gave each. The coordinator reviews and saves them as `ReviewInput` rows. **This is the highest-value feature**, because the coordinator records all BOS inputs (D3) |
| AI-9 | **Action Taken drafts** | Compares each input with the changes between versions (e.g. V2.0 → V2.1) and drafts the "Action Taken" text; the faculty member or coordinator edits it |
| AI-10 | **Change summary** | Plain-language summary of what changed between any two versions, for presenting at the next meeting |
| AI-11 | **Department-wide checks** | Topics overlapping between courses, prerequisites not taught in an earlier semester, POs/PSOs/SDGs no course covers |

**For Dean Academics**

| # | Feature | What it does |
|---|---|---|
| AI-12 | **Quality report** | Institution-wide summary of CO quality, PO coverage per programme and SDG coverage |
| AI-13 | **Help assistant** | Answers questions about the regulations and how to use the portal, using the configured scheme rules and the user guide as its source |

**Migration**

| # | Feature | What it does |
|---|---|---|
| AI-14 | **Word syllabus import** | Converts existing Word syllabi (e.g. the 2022 scheme) into structured data, ready to carry forward as a new V1.0 after the faculty member checks it |

### 15.3 How it fits the architecture

- **`backend/src/ai/`**: one function per feature (in the backend, because it holds the API key). Each takes typed input and returns output **validated against a Zod schema** (the same schemas used by the forms), so suggestions fit straight into the form fields.
- **Server-side only.** The API key lives in server environment variables and never reaches the browser. Calls are made from API routes or pg-boss jobs.
- **Long tasks run as background jobs:** AI-8 for long notes, AI-10, AI-11, AI-12 and AI-14.
- **SDK:** **Vercel AI SDK** (`ai` package) with the **Anthropic** provider. Structured output works with Zod, and the provider can be changed later without rewriting features.
- **Models** (set in configuration, not code):
  - a capable model (e.g. `claude-sonnet-5-5`) for drafting and analysis: AI-3, AI-8, AI-9, AI-10, AI-11, AI-14
  - a smaller, cheaper model (e.g. `claude-haiku-5-5`) for quick checks: AI-1, AI-4, AI-5, AI-7
- **Prompts** are stored as versioned files in `backend/src/ai/prompts/`. Each suggestion records the prompt version that produced it.
- **What is sent to the model:** only syllabus content and the scheme rules it needs. Reviewer personal details (email, phone) are left out. Names are included only for AI-8, where they are needed.

### 15.4 Configuration (Layer 1, Dean Academics)

- AI on or off, globally and per feature (AI-1 … AI-14)
- Model per feature group
- **Monthly usage cap per department**; when it is reached, AI features are paused for that department and the rest of the portal keeps working
- A disclosure line on printed PDFs if institutional policy requires it (e.g. "Prepared with AI assistance"), turned off by default

### 15.5 Data model additions

```
AiSuggestion: feature (AI-1…AI-14), syllabus, version/working-copy ref, section_ref,
              input_snapshot, output JSON, status (proposed | accepted | edited | rejected),
              decided_by, decided_at, prompt_version, model
AiCallLog:    user, department, feature, model, prompt_version, input_tokens, output_tokens,
              latency_ms, success, created_at          (used for monthly caps and the cost report)
AiSettings:   enabled, per-feature switches, model per feature group, department monthly caps
```

### 15.6 Before turning AI on
- Confirm the institution's policy on using AI in academic documents, including whether disclosure is required.
- Check the AI provider's commercial data-use terms.
- Test every feature with a fixed set of real 2025 syllabi before the pilot (see §13).

---

## Appendix A — 2025 scheme reference data (CSE, semesters III–IV)

| Category | Credits | Hrs/wk L:T:P | L | T | P | TW&SL | Total | CIE | SEE | Format |
|---|---|---|---|---|---|---|---|---|---|---|
| PCC / ASC | 3:0:0 | 3:0:0 | 42 | 0 | 0 | 48 | 90 | 100 | 100 | Theory |
| PCC (e.g. 1BCS305) | 4:0:0 | 4:0:0 | 56 | 0 | 0 | 64 | 120 | 100 | 100 | Theory |
| IPCC (also ASC 1BCS401) | 3:0:1 | 3:0:2 | 42 | 0 | 28 | 50 | 120 | 100 | 100 | Integrated / Integrated-Project |
| BSC | 2:0:0 | 2:0:0 | 28 | 0 | 0 | 32 | 60 | 100 | 100 | Theory |
| PCCL / AEC | 0:0:1 | 0:0:2 | 0 | 0 | 28 | 2 | 30 | 50 | 50 | Lab |
| SDC | 1 | 2:0:0 | 28 | 0 | 0 | 2 | 30 | 100 | — | (Q3) |
| NCMC | PP | — | 0–14 | 0 | 0 | 14–28 | 28 | 100 | — | (Q3) |

Notes:
- 1 credit = 30 hours of student effort.
- 14 weeks × weekly hours = semester contact hours.
- The SDC course does not follow the general rule: 1 credit with 2 contact hours per week. This shows why credit patterns must be configured per category, not derived from a single formula.

## Appendix B — Sections in each format

| Section | Theory | Integrated | Integrated-Project | Lab/AEC |
|---|:-:|:-:|:-:|:-:|
| Header table | ✔ | ✔ | ✔ | ✔ |
| Course learning objectives | ✔ | ✔ | ✔ | ✔ |
| Pre-requisites / Required knowledge | ✔ | ✔ | ✔ | ✔ ("Required Knowledge of") |
| Units I–V with contact hours | ✔ | ✔ | ✔ | — |
| Experiments | — | 10 + 3 open-ended | 10 + 2 open-ended | 12 + 2 open-ended (2 h each) |
| Flipped classroom (sessions per unit) | ✔ | ✔ | ✔ | — |
| Text books / Reference books / E-resources | ✔ / ✔ / ✔ | ✔ / ✔ / ✔ | ✔ / ✔ / ✔ | ✔ / — / ✔ |
| Delivery and assessment methods | text block | text block | text block | text block |
| Suggested learning activities | text block | text block | — | — |
| TW and SL tables | ✔ | ✔ | ✔ | ✔ |
| COs (statement, level, POs, PSOs) | ✔ | ✔ | ✔ | ✔ |
| CIE scheme | 2nd-yr / 3rd-yr variant | Theory 60 + Lab 40 | Theory 40 + Project 60 (Phase 1 at week 7, Phase 2 at week 14, report) | Lab 50 |
| SEE scheme | text block | text block | 100 marks: open-ended lab problem 50 + project evaluation 50 | Lab 50 |
| Rubrics | Assignment, CP 20 / CP 80 | Assignment, CP 10 | Project Phase 1 / Phase 2 (60) | Lab conduction |
| CO–PO–PSO–WK–SDG matrix (tick) | ✔ | ✔ | ✔ | ✔ |
| Signature block | ✔ | ✔ | ✔ | ✔ |
