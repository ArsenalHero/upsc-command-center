# UPSC Command Center

Website: [arsenalhero.github.io/upsc-command-center](https://arsenalhero.github.io/upsc-command-center/)

A study tracker for UPSC preparation: syllabus, sessions, goals, practice, tests, revision, and reports. The complete React/TypeScript source is in `app/`; the built website is at this repository's root.

## PYQ practice

The [PYQ section](https://arsenalhero.github.io/upsc-command-center/#/pyqs) contains **2025 only**: 100 Prelims GS-I and 80 CSAT Booklet A questions, displayed as selectable text with original statements, tables and passages. Filter by subject, topic, subtopic, difficulty and status; practise a set or take a full paper with an optional 2-hour deadline. Both official answer keys are connected, including one-third negative marking.

Individual practice continues through the selected paper, with a Next question action beside feedback and a saved option to advance automatically after submission. Reports have spaced tables and an outcome infographic. Each attempt saves its answer, result, active time, confidence, mistake category, notes and review flag. Tests hide feedback until submission; drafts resume after reload, completed reports show score and performance breakdowns, and revision lists keep mistakes/bookmarks. Repeat attempts preserve history. Earlier years and Mains records remain in History and backups. All 80 CSAT and nine GS questions have checked study explanations; remaining GS reasoning is visibly awaiting verification. See [sources and data rules](app/docs/PYQS.md).

## Lectures

The [Lectures workspace](https://arsenalhero.github.io/upsc-command-center/#/lectures) lets you set a total and daily target for each subject, name a course, set an optional deadline, and record the number completed each day. Completion rings, subject progress cards, daily bars and a 28-day activity calendar show totals through the selected day. Edit a daily total without duplicating it; JSON backups retain targets and logs, and lecture CSV exports include each day. See [lecture data rules](app/docs/LECTURES.md).

## Account pages

- [Log in](https://arsenalhero.github.io/upsc-command-center/#/login)
- [Sign up](https://arsenalhero.github.io/upsc-command-center/#/signup)
- [Reset password](https://arsenalhero.github.io/upsc-command-center/#/forgot-password)

**The Supabase backend is connected; public account activation is still being completed.** The Free-plan `upsc-command-center` project is in Mumbai, and its private workspace migration is applied. The public browser configuration contains the project URL and publishable key. Website redirects and public confirmation/recovery email delivery must be configured and live-tested before public signup is considered ready. Guest tracking continues to work, and existing device records are preserved.

The implementation includes email/password authentication, confirmation/resend, password recovery, separate private study workspaces, queued cloud saves, pending-change backups, account cache cleanup at signout, and protection against stale saves from another device. It uses Supabase Auth and Postgres row-level security; browser-only password storage is not used.

Follow [account/backend setup](app/docs/ACCOUNTS.md) to activate the database, public signup, correct redirect URLs, and public email delivery. Only the project URL and a **publishable** (or legacy anon) key belong in `app/public/auth-config.json` and the root `auth-config.json`. Private server keys and SMTP passwords must never be committed.

## Develop and publish

Use Node.js 22+ and npm at the repository root:

```bash
npm ci
npm run dev
npm test
npm run test:ui
npm run build
```

`npm run build` builds the app workspace, generates its service worker, and copies the complete output from `app/dist/` to the repository root. Commit the changed source and generated site files together. Edit `app/src/` and `app/index.html`; the root `index.html` is generated output.

Keep the existing GitHub Pages setting: **Deploy from a branch → main → / (root)**. A main-branch update triggers the Pages build/deployment. Check the Actions result for completion. Keep `.nojekyll`, every referenced `assets/` file, the manifest, and the icons. Old hashed assets can remain for visitors who already loaded an earlier build.

## Use your workspace

Choose Continue as guest to keep data in this browser. Use Settings to export JSON backups and restore them elsewhere. Once accounts are activated, log in on any device with the same email to load your private records. The Account page includes sync status, backups, optional import of guest records, and signout.

Account and guest records are separate. Importing a guest workspace into an account asks for confirmation before replacing the account records. If another device has saved newer changes, the app asks you to export pending work and load the cloud copy instead of silently overwriting it.

## Checks

The test suite includes analytics/validation/storage checks, PYQ paper completeness and grading, timer accounting, backups and exports, account cache isolation, failed-save retry, serialized writes, captured owner tokens, and actual PostgreSQL migration/permission tests with PGlite. Auth UI tests use the real Supabase SDK against a simulated API and cover signup, confirmation/resend, recovery callbacks, password changes, login/logout, study sync, and two-user isolation. PYQ UI tests cover combined filters, selectable text/tables/passages, hidden-tab timing, official marking, resumed drafts, review edits, skips, repeat history, test feedback secrecy, CSAT marking, expired deadlines and atomic failed-save recovery. Lecture tests cover independent subject targets, daily totals, chart periods, edited entries, refresh restoration, backups, quota failure and account isolation. Older Mains records remain covered by compatibility tests.

The live database's RLS, caller permissions and anonymous HTTP rejection have been checked, and its security advisor reported no notices. Automated Auth UI tests use a simulated API; they do not establish real signup, email delivery or cross-device login. Those live checks remain part of activation. See [verification notes](app/docs/VERIFICATION-RESULTS.md) and [full app guide](app/README.md).
