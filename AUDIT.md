# GIT-BOS audit: README vs implementation

Oct 24, 2026 · @Vijaylaxmi

## Summary

The portal implements the README's workflow end to end, Phases 0–4, but it is not ready for real users: two high-severity sign-in issues and the unverified printouts must be fixed first. Of 39 README features (AI assistance excluded), 24 are implemented, 6 partial and 9 missing. Most of the gaps are operations (deployment, backups, monitoring) rather than features.

Top risks, in order:

1. **Account takeover through Microsoft sign-in (S1).** It accepts any Microsoft tenant and links accounts by unverified email. It is dormant until its credentials are set.
2. **Shared default password (S2).** Reset accounts use a published password that users are not forced to change.
3. **Printouts not checked against the official templates (M1).** Approved PDFs are frozen permanently, so a layout error would be frozen with them.
4. **No backups or monitoring (M6, M7)** once real syllabi are entered.
5. **Frozen PDFs that can drift from what was approved (L1)** when the PDF engine is down at approval time.

How this was done: every README section (§2–§13, Phases 0–5) was traced to code on commit bb079f9 (24 Oct 2026); the security review read sign-in, permissions, every public route, uploads, PDF generation, notifications and the deployment files. Results of the end-to-end tests run on 23 Oct are taken into account. AI assistance (§15, Phase 2A) is out of scope.

## Status update (24 Oct 2026, later the same day)

Fixed in code since this audit: every security, logic and edge-case issue (S1–S5, L1–L5, E1–E4), and M2 branding, M3 section layout, M4 audit log and database role, M6 backup scripts, M10 expert-link limits, M11 whole-scheme book and M14 QR verification. README decisions D17, D18 and D22 record them. Still open: M1 (printouts against the Word templates), M5 deployment, M7 monitoring, M8 background jobs, M9 CI and staging, M12 image tests, M13 rich-text units and M15 link check.

## Feature status

24 of 39 README features are implemented, 6 are partial and 9 are missing. The application itself is complete for Phases 0–4; what is partial or missing is mostly configuration depth, operations and verification. Status is from reading the code on 24 Oct 2026 (commit bb079f9) and the end-to-end tests run on 23 Oct.

| #   | Feature (README reference)                                                                             | Status      | Evidence / note                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Google sign-in for @git.edu only, no self sign-up (D17)                                                | Implemented | `auth/auth.js`: `hd` check, `disableSignUp`, user-create hook. Needs real Google credentials.                                  |
| 2   | Super Admin password, forced change, emailed reset code (D15)                                          | Implemented | `auth/auth.js`, `routes/me.js`, `scripts/super-admin.js`                                                                       |
| 3   | Reset any user to the default password (D18)                                                           | Implemented | `routes/admin.js`. Works as decided, but see issue S2.                                                                         |
| 4   | Roles with department scope, one `can()` (§4)                                                          | Implemented | `shared/domain/auth/permissions.js`, checked on every route                                                                    |
| 5   | Users, departments, programmes (Administrator)                                                         | Implemented | `routes/admin.js`, admin pages                                                                                                 |
| 6   | Institution branding: name, address, logos on documents (§5)                                           | Missing     | Seeded only. No edit screen or route; no logo printed.                                                                         |
| 7   | Scheme draft → publish → retire, clone Layer 1 (§5)                                                    | Implemented | `routes/schemes.js`                                                                                                            |
| 8   | Categories, credit patterns, formats, text blocks by year, PO/WK/SDG, Bloom (§5)                       | Implemented | `routes/schemes.js`, scheme page tabs                                                                                          |
| 9   | Format section order, on/off and heading labels set by Dean Academics (§5, §8)                         | Partial     | `FormatConfig.sections` exists but is never read. Only the title, pre-requisites label, counts and reference-book switch work. |
| 10  | Course lists, elective baskets, PSOs, Excel import and export (§5)                                     | Implemented | `routes/course-lists.js`, `services/course-excel.js`                                                                           |
| 11  | Reviewer directory and faculty assignments (D13)                                                       | Implemented | `routes/departments.js`                                                                                                        |
| 12  | Scheme amendments: “Needs revision” flags, checks re-run (§5)                                          | Implemented | `services/amendments.js`, scheme Amendments tab                                                                                |
| 13  | Copy a course list into a cloned scheme; carry a syllabus forward as V1.0 (Phase 4)                    | Implemented | `services/carry-forward.js`, `e2e/scheme-change.spec.js`                                                                       |
| 14  | Syllabus editor for all four formats, autosave, conflict detection (Phase 1, 3)                        | Implemented | `pages/syllabus-page.jsx`, `routes/syllabi.js`                                                                                 |
| 15  | Validation rules (§9), incl. CO–unit coverage                                                          | Implemented | `shared/domain/syllabi/validate.js`. The optional e-resource link checker is not built.                                        |
| 16  | Restricted rich-text editor for unit content (§10)                                                     | Missing     | Unit content is plain text (README Phase 1 notes this).                                                                        |
| 17  | Print layouts, preview and PDF: Carlito, running header, page X of Y, DRAFT watermark, signatures (§8) | Implemented | `shared/print/syllabus-layout.js`. Not yet compared with the Word templates.                                                   |
| 18  | Action Taken report, four stages, unlock rows (§7)                                                     | Implemented | `shared/print/action-taken-layout.js`. Not compared with `Action Taken Format.docx`.                                           |
| 19  | Immutable versions V1.0 … V4.x, comparison (§7)                                                        | Implemented | DB trigger `syllabus_version_no_change`, `domain/reviews/compare.js`                                                           |
| 20  | Meetings, inputs, action taken, closing stages, approval, unlock (§7)                                  | Implemented | `routes/reviews.js`, `e2e/review-workflow.spec.js`                                                                             |
| 21  | Email notifications                                                                                    | Implemented | `services/notifications.js` (queued, grouped, retried)                                                                         |
| 22  | Expert links: hashed token, expiry, revoke, comments (§7 rule 6)                                       | Partial     | `routes/expert.js`. The “request limits” in §11 are missing (issue S3).                                                        |
| 23  | Integrated, Integrated-Project and Lab/AEC formats (Phase 3)                                           | Implemented | One layout, `LAYOUT_VERSION` 2. Not compared with the Word templates.                                                          |
| 24  | Frozen PDFs of approved versions with SHA-256 (§8)                                                     | Implemented | `services/documents.js`, DB trigger. See issue L1.                                                                             |
| 25  | QR code and verification page on approved PDFs (§8, optional)                                          | Missing     | Not built                                                                                                                      |
| 26  | Dashboards by department, programme, semester (Phase 4)                                                | Implemented | `routes/dashboard.js`, `pages/dashboard-page.jsx`                                                                              |
| 27  | Compiled syllabus book: cover, scheme table, linked contents, bookmarks (§8)                           | Partial     | Per programme or semester (`services/book.js`). The per-scheme book is missing.                                                |
| 28  | Approved syllabi readable by everyone (D19)                                                            | Implemented | `routes/approved-syllabi.js`                                                                                                   |
| 29  | List tables: search, filters, sorting, paging, S.No (D20)                                              | Implemented | `components/data-table/`                                                                                                       |
| 30  | Append-only audit log (§11)                                                                            | Partial     | Written for every change, but rows can be edited or deleted (no trigger).                                                      |
| 31  | Sign-in rate limits in production (§10)                                                                | Implemented | `auth/auth.js` `rateLimit`                                                                                                     |
| 32  | Least-privilege database user (§11)                                                                    | Missing     | The app connects as the owner of every table.                                                                                  |
| 33  | Background jobs with pg-boss (§10)                                                                     | Missing     | Not used. Books and PDFs render inside the request.                                                                            |
| 34  | Monitoring: Sentry and Uptime Kuma (§10)                                                               | Missing     | Not set up                                                                                                                     |
| 35  | Nightly off-server backups, monthly restore test (§10)                                                 | Missing     | No scripts                                                                                                                     |
| 36  | Production deployment: Docker Compose, Caddy, Gotenberg (§10)                                          | Partial     | Files are written and look correct, but have never been run.                                                                   |
| 37  | CI on GitHub Actions (§10)                                                                             | Partial     | `ci.yml.disabled` (turned off on 24 Oct)                                                                                       |
| 38  | Print-layout image tests (§13)                                                                         | Missing     | Not built                                                                                                                      |
| 39  | Staging environment (§10)                                                                              | Missing     | Not set up                                                                                                                     |

Not audited, as instructed: AI assistance (§15, Phase 2A). Phase 5 (pilot, training, rollout) is process, not code.

## Missing implementations

Fifteen items need work, listed in the order they matter for the CSE pilot. M1–M4 affect what users see or what the institution signs; M5–M10 are operations; M11–M15 are optional or later.

### M1. Check the printouts against the Word templates (features 17, 18, 23)

1. Print one complete syllabus of each format (Theory, Integrated, Integrated-Project, Lab/AEC) and one Action Taken report.
2. Put each beside its Word reference from `F:\GIT-BOS\` and list every difference: margins, column widths, headings, fonts, row order.
3. Fix them in `shared/print/syllabus-layout.js` and `action-taken-layout.js`; bump `LAYOUT_VERSION`.
4. Get Dean Academics to sign off each layout (README §14), then freeze the reference PDFs for M12.

### M2. Institution branding (feature 6)

1. Add `PUT /api/admin/institution` guarded by the existing `institution.manage` permission, with a Zod schema for name, short name, address and established year.
2. Accept a logo upload (PNG or SVG, at most 200 KB) with Multer; store it in a new table or as bytes, never as a file path from the user.
3. Add an Institution card to the Administrator's Departments page.
4. Print the logo and address in the syllabus title block, the Action Taken header and the book cover; embed the image as a data URL, as the fonts are, so PDF jobs need no network.
5. Bump `LAYOUT_VERSION`; approved PDFs stay frozen as they were.

### M3. Section order, on/off and heading labels (feature 9)

1. Define the section list per format in `shared/` (`id`, default label, can be turned off), the same ids the layout already prints.
2. Store Dean Academics' choices in the existing `FormatConfig.sections` JSON: order, enabled, label. Validate it with Zod in `formatConfigSchema`.
3. Add an editor in the Formats tab: drag or up/down buttons, a switch per section, a label field.
4. Make `renderSyllabusLayout` and the editor's section list read that order and those labels; keep the defaults when the JSON is empty.
5. Record a change as a scheme amendment (it already is for formats) and bump `LAYOUT_VERSION`.

### M4. Append-only audit log and least-privilege database user (features 30, 32)

1. Add a migration with a trigger on `audit_log` that refuses `UPDATE` and `DELETE`, like `syllabus_version_no_change`.
2. Create a second PostgreSQL role, `acp_app`, with `SELECT, INSERT, UPDATE, DELETE` on the tables and `INSERT, SELECT` only on `audit_log`. The owner role runs migrations only.
3. Point the app's `DATABASE_URL` at `acp_app` in `docker-compose.yml`; keep the owner URL for `db:deploy`.

### M5. Production deployment (feature 36)

1. Install Docker on the Hostinger VPS (Ubuntu 24.04) and run `docker compose build` and `db:deploy` as the README says.
2. Set `NODE_ENV=production` secrets in `.env`: `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, real SMTP, `GOOGLE_*`.
3. Point the DNS A record at the VPS; check that Caddy obtains the certificate.
4. Test sign-in, a PDF through Gotenberg, an email and an expert link from outside the campus network.
5. Harden the server per README §10: ufw (22, 80, 443), SSH keys only, fail2ban, unattended upgrades.

### M6. Backups and restore test (feature 35)

1. Add a `backup` service or host cron job: nightly `pg_dump -Fc`, compressed, named by date.
2. Copy it off the VPS with rclone to Backblaze B2 or the institute's Google Drive; keep 30 daily and 12 monthly copies.
3. Write `deploy/RESTORE.md` and restore into a scratch database once a month; record the date.

### M7. Monitoring (feature 34)

1. Add Sentry to Express (error handler) and to the React app (error boundary); never send request bodies, which hold syllabus text.
2. Run Uptime Kuma (or a free external monitor) against `/api/me` and alert the IT cell by email.

### M8. Background jobs (feature 33)

1. Add pg-boss (it uses the existing PostgreSQL; no Redis).
2. Move the compiled book into a job: the request queues it and returns a job id; the page polls and downloads the result when ready.
3. Optionally move freezing PDFs after approval into a job with retries, replacing the current `setImmediate`. That also fixes issue L1.

### M9. CI and staging (features 37, 39)

1. Rename `ci.yml.disabled` back when ready; add a PostgreSQL service to run the end-to-end tests in CI.
2. Create a second compose project `staging.<domain>` with its own database; deploy there before production.

### M10. Expert-link request limits (feature 22)

See issue S3: a per-token and per-IP limit on `/api/expert`, plus a cap on comments per link.

### M11. Compiled book for a whole scheme (feature 27)

1. Add `GET /api/schemes/:schemeId/book/pdf`, allowed to Dean Academics.
2. Reuse `buildSyllabusBook`: one part per programme (cover per programme, then its semesters), bookmarks nested programme → semester → course.
3. Run it as a pg-boss job (M8); a whole scheme is many hundreds of pages.

### M12. Print-layout image tests (feature 38)

1. Keep a fixed sample syllabus JSON per format in `shared/print/fixtures/`.
2. Render it to PDF in a test, rasterise each page (pdf.js in Node), and compare with stored reference images using a small pixel tolerance.
3. Update the references only when `LAYOUT_VERSION` changes, after the M1 sign-off.

### M13. Restricted rich-text editor for unit content (feature 16)

1. Use Tiptap with only bold, italic, bullet and numbered lists enabled.
2. Store HTML cleaned on the server with an allow-list (for example `sanitize-html` limited to `p, strong, em, ul, ol, li, br`).
3. Print it through the same allow-list; keep reading old plain-text units as before.

### M14. QR verification of approved PDFs (feature 25, optional)

1. Add a public route `/verify/:documentId` showing course, version, approval date and reference, and the SHA-256.
2. Print a QR code (the `qrcode` package, SVG) of that address on approved PDFs only; bump `LAYOUT_VERSION`.
3. Rate-limit the public route; show nothing beyond what is printed on the document.

### M15. E-resource link check (feature 15, optional)

1. A pg-boss job fetches each e-resource URL (HEAD, then GET, 10 s timeout, no private IP ranges).
2. Store the result per URL with its date; show broken links as a warning in the Checks panel, never as an error.

## Identified issues and loopholes

Two high-severity issues need fixing before the portal is used with real accounts: account takeover through Microsoft sign-in, and the shared default password. The rest are medium or low. S = security, L = logic, E = edge case.

| ID  | Severity | Issue and impact                                                                                                                                                                                                                                                                                                                                                               | Where                                                              | Fix                                                                                                                                                                                                       |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | High     | Microsoft sign-in (not in the README; D17 says Google only) accepts any tenant (`tenantId: "common"`) and is a trusted provider for account linking. Better Auth then links by email even when Microsoft has not verified it, so someone who controls a Microsoft tenant can sign in as any staff member (the “nOAuth” pattern). Live as soon as `MICROSOFT_CLIENT_ID` is set. | `backend/src/auth/auth.js`                                         | Remove Microsoft until needed. If kept: set the institute's own `MICROSOFT_TENANT_ID` (refuse `common`), drop it from `trustedProviders`, and reject sign-ins whose `tid` is not the institute's.         |
| S2  | High     | Reset-to-default (D18) gives users `Password@123`, published in the README and `.env.example`, and does not force a change. Password sign-in is open in production, so any colleague can sign in as a reset user until they change it.                                                                                                                                         | `routes/admin.js`, `.env.example`                                  | Set `passwordChangeRequired: true` on reset (the forced-change screen exists already). Better: generate a random one-time password shown once to the Super Admin. Never ship a default in `.env.example`. |
| S3  | Medium   | The public expert routes have no rate or volume limit (README §11 promises “request limits”). A leaked link can add thousands of 4,000-character inputs, which block closing the stage until each has an action taken.                                                                                                                                                         | `routes/expert.js`                                                 | Rate-limit `/api/expert` per IP and per token (e.g. 30 requests per minute); cap comments per link (e.g. 200); log refusals.                                                                              |
| S4  | Medium   | No rate limit on expensive endpoints: draft PDFs, the compiled book and Excel import run headless Chromium or unzip inside the request. A signed-in user (or a script with their session) can exhaust the PDF engine (Gotenberg is capped at 1 GB) and slow the portal for everyone.                                                                                           | `http/pdf.js`, `services/book.js`, `routes/course-lists.js`        | A general limiter on `/api` plus a stricter one on PDF and book routes; run books as background jobs (M8); limit concurrent Chromium renders (a small queue).                                             |
| S5  | Medium   | The audit log is not append-only, and the app connects as the owner of every table, so anyone with the app's database password can rewrite history.                                                                                                                                                                                                                            | `audit_log` table, `DATABASE_URL`                                  | M4: trigger plus a least-privilege role.                                                                                                                                                                  |
| L1  | Medium   | A “frozen” PDF that could not be made at approval (PDF engine down) is generated at first download, using the institution, text blocks and layout in force then. It can differ from what the Academic Council approved, yet carries the approval's checksum.                                                                                                                   | `routes/reviews.js` `freezeAfterApproval`, `services/documents.js` | Snapshot the print data (institution, text blocks, lists, format) into the version at approval, and render the frozen PDF from that snapshot; retry freezing as a job (M8).                               |
| L2  | Medium   | Edit rights to a syllabus come from the course assignment alone. A person whose Faculty role is removed, or who moves department, keeps editing (and submitting) their old syllabi.                                                                                                                                                                                            | `services/syllabi.js` (`isAssigned`)                               | Remove assignments when the department's Faculty role is removed; or require an active Faculty role in the owning department in `can("syllabus.edit")`.                                                   |
| L3  | Medium   | A BoS Coordinator can rename a course owned by another department: saving or importing a course row with a known code overwrites the shared course title.                                                                                                                                                                                                                      | `services/courses.js` `upsertSchemeCourse`                         | Change the title only when the actor coordinates the owning department; otherwise refuse or keep the existing title with a warning.                                                                       |
| L4  | Low      | Two Course Coordinators can be saved for one course at the same moment: the check runs before the transaction and the database has no rule against it.                                                                                                                                                                                                                         | `routes/departments.js` assignments                                | A partial unique index on (scheme, course) where role = COORDINATOR, or the check inside a serialisable transaction.                                                                                      |
| L5  | Low      | After an amendment, the re-check of flagged syllabi runs in memory after the response; a restart in between leaves the flags without error counts.                                                                                                                                                                                                                             | `routes/schemes.js` `recheckLater`                                 | Run it as a job (M8), or compute counts when the flag is first shown.                                                                                                                                     |
| E1  | Low      | An Administrator can give themself any role, including BoS Coordinator or Dean Academics, then approve syllabi. Only the audit log records it.                                                                                                                                                                                                                                 | `routes/admin.js` roles                                            | Require a Super Admin for Dean Academics and BoS Coordinator grants, or refuse grants to oneself.                                                                                                         |
| E2  | Low      | Sessions last 7 days with no idle timeout; staff use shared lab and office computers.                                                                                                                                                                                                                                                                                          | `auth/auth.js` `session`                                           | Shorten to 1–2 days, or add an idle timeout; sign out on browser close for shared machines.                                                                                                               |
| E3  | Low      | The expert token is part of the URL path, so it can appear in proxy or server logs. Responses already send no-store and no-referrer.                                                                                                                                                                                                                                           | `routes/expert.js`                                                 | Keep Caddy access logs off or strip `/expert/*` paths from them.                                                                                                                                          |
| E4  | Low      | An Excel upload is a zip file; a small, highly compressed workbook can expand to hundreds of MB in memory during import.                                                                                                                                                                                                                                                       | `services/course-excel.js`                                         | Check the uncompressed size and row count before loading the workbook.                                                                                                                                    |

Checked and found sound: permission checks between departments on every route, CSRF (same-site cookies and JSON-only bodies), HTML escaping in all print layouts, sandboxed preview iframes without scripts, the 256-bit hashed expert tokens, the immutable-version and frozen-PDF triggers, the font route's file allow-list, and the production Docker and Caddy settings (non-root user, HSTS, `NODE_ENV=production`).

## Recommended order of work

Fix the two high-severity issues first; they are small. Then make the printouts match the official templates, deploy with backups, and run the CSE pilot. Everything else can follow the pilot.

Before any real user signs in (about 1 day):

- [x] S1: remove Microsoft sign-in, or restrict it to the institute's tenant
- [x] S2: force a password change after a reset to default; remove the default from `.env.example`
- [x] S3, S4: rate limits on `/api/expert`, PDF and book routes; cap comments per expert link
- [x] M4 / S5: append-only audit log and a least-privilege database role

Before the CSE pilot (about 1–2 weeks):

- [ ] M1: compare every printout with its Word template; Dean Academics signs off each layout
- [x] M2: institution branding (name, address, logo) on syllabi, reports and the book
- [x] L1: snapshot print data at approval so frozen PDFs match what was approved
- [x] L2, L3: assignment rights after role changes; cross-department course renames
- [ ] M5, M7: deploy to the VPS with HTTPS; monitoring
- [x] M6: nightly off-server backup and monthly restore-test scripts, `deploy/RESTORE.md` (to be installed on the VPS at deployment)
- [ ] Put the database launcher and `@embedded-postgres` back in the repo, so `npm install` and reboots stop breaking development

During or after the pilot:

- [x] M3: section order, on/off and heading labels for Dean Academics
- [ ] M8: background jobs
- [x] M11: whole-scheme syllabus book
- [ ] M9, M12: CI with end-to-end tests, staging, print-layout image tests
- [ ] M13, M15: rich-text units, link check
- [x] M14, L4, L5, E1–E4: QR verification, remaining low-severity fixes
- [x] Update README §12: Phase 4 is built but still listed as not started
