# Verification results

Verified in the build environment on 2026-10-04:

| Check | Result |
|---|---|
| Full TypeScript app (`npm run typecheck`) | Passed |
| Analytics/storage/auth/cache/validation/Postgres/PYQ/revision/exam/book tests | 69 passed, 0 failed |
| Real React app rendered in JSDOM (`npm run test:ui`) | All seven suites passed |
| Chapter lists/ranges, deduplication, per-chapter revision credit, full-book cycles, weighted completion, valid histories and book JSON/CSV preservation | Passed |
| Books forms, initial progress, chapter maps, safe edits, read-before-revision, subject filters, suggested books, reload and atomic failed-save retry | Passed in rendered UI |
| Books saved through the real Auth SDK and existing private workspace transport | Passed against the simulated API; another user's account has no book records |
| Five-review 1–7–14–30–90 preset, late completion shifts, custom switches, completion dates, duplicates and legacy backup/export compatibility | Passed |
| Revision preset/custom/off radios, calendar entries, reload and atomic save failure/retry | Passed in rendered UI |
| State PSC setup and personal workspace selection, required name/date, CSE defaults and preserved settings on exam switches | Passed in unit and rendered UI checks |
| Seconds countdown, explicit IST date boundary, expired dates, reload and dashboard timer cleanup | Passed in unit and rendered UI checks |
| Setup default eight-hour target and complete State PSC wizard | Passed in rendered UI; corrected the previous step mismatch |
| First-time setup, empty state, demo mode and all 20 routes | Passed in rendered UI |
| Report periods, study form persistence and fresh-DOM restoration | Passed in rendered UI |
| Active bank scope and complete Booklet A numbering | 1,353 entries: unchanged 2025 GS I 100 + CSAT II 80, plus 1,173 uploaded Polity questions |
| Full source-file audit of uploaded questions, options, answers and explanations | All 1,173 entries preserved; explanation text and source SHA-256 digests match |
| Exam collection, state, year and shared-occurrence filtering | Passed; uploaded memberships UPSC CSE 272, State PSC 571, CDS/CAPF 330, Unlabelled 1, with one shared entry |
| Five-choice questions and source Mains MCQs | Passed; 31 five-choice questions, six provided E answers; source Mains items remain objective |
| Supplied answer grading, zero practice penalties and saved source/exam metadata | Passed in unit and rendered UI checks; supplied keys remain visibly distinct from official keys |
| Imported State PSC filters, E answer/time persistence, reload and Next question | Passed in rendered UI; all original full-paper tests still contain exactly 100 GS or 80 CSAT items |
| Selectable text, semantic lists, matching tables and passages | 180 questions; ten GS tables and 29 CSAT passage items |
| Original English paper pages and official Series A key tables | Visually inspected; all 180 answers match the checked keys |
| Scan-sensitive formulas, intervals, subscripts and option labels | Source checked; representative corrections covered by integrity tests |
| Editorial study explanations | 89 checked; the other 91 GS explanations explicitly await verification |
| Practice grading, notes, confidence, review flags, skips and repeat history | Passed in rendered UI |
| Active timer excludes hidden time; draft restoration retains saved seconds | Passed in rendered UI and timer tests |
| Ordered full-paper tests and answers hidden until final submission | Passed in rendered UI |
| Timed-test expiry while away and automatic completion on resume | Passed in rendered UI |
| Exact negative marking, frozen keys and subject/topic/difficulty reports | Passed; one right plus three wrong cancels out in either paper |
| Failed storage write, visible retry and duplicate-attempt prevention | Passed in rendered UI |
| Version-1 history/backups, new sessions/reports and flat CSV columns | Passed |
| Continuous individual PYQ practice and optional automatic advance | Passed in rendered UI |
| Lecture targets, independent subject totals and daily aggregation | Passed |
| Lecture forms, edits without duplicate days, filters, chart periods, reload and failed-save retry | Passed in rendered UI |
| Lecture JSON/CSV preservation, formula escaping and invalid-entry rejection | Passed |
| Real Auth SDK and cloud flows against a simulated API | Passed; signup, recovery, login/logout, study/PYQ/lecture/book sync, cache cleanup and two-user isolation |
| Actual Postgres migration and permissions in local PGlite | Passed; anonymous rejection, row isolation, authorized writes and conflicts |
| Live Supabase private workspace schema, grants and RLS | Passed; anonymous HTTP read rejected, direct client writes revoked, privileged writer kept outside the exposed schema |
| Live Supabase security advisor | No notices |
| Production build and lazy imports (`npm run build`) | Passed |
| Built HTML asset references, manifest icons and service-worker syntax | Passed |
| HashRouter and relative Vite base | Confirmed in source and production references |
| Live browser visual inspection | Passed on the deployed desktop site: Lectures dashboard, continuous PYQ navigation and report table spacing |
| Browser download UI, PWA installation/offline upgrade | Not executed |
| Live Supabase email/password and callback configuration | Public signups enabled, confirmation required, eight-character password minimum saved; Site URL and both exact callbacks verified after reload |
| Published account pages | Login and signup forms enabled with the live public configuration; inspected without submitting credentials |
| Live Supabase accounts and email delivery | Project, private database and callbacks connected; custom SMTP and real signup/confirmation/login/recovery checks remain pending |
| Optional WebMCP in a supported real browser context | Not executed |

These results distinguish functional DOM checks from browser visual verification. The deployed desktop Lectures dashboard and PYQ report were inspected and captured. In a fresh guest workspace, submitting GS I question 1 and selecting Next question opened question 2 directly. Responsive CSS is present; mobile screenshots have not been inspected. See [QA.md](QA.md) for remaining browser checks.

The frontend is linked to `ArsenalHero/upsc-command-center` on GitHub Pages. The release is checked against the repository's Pages deployment after publication. The Free-plan Supabase project is now created in Mumbai, the private workspace migration is applied, and `auth-config.json` contains only its public URL and publishable key. Email/password authentication and public signups are enabled with email confirmation required and an eight-character password minimum saved in the dashboard. The Site URL and exact confirmation/recovery callbacks were verified after reload. Custom SMTP is still disabled; live user-account and email-delivery checks remain pending. Passing local or simulated-API tests does not establish those remaining checks.
