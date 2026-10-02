# UPSC Command Center

Website: [arsenalhero.github.io/upsc-command-center](https://arsenalhero.github.io/upsc-command-center/)

A study tracker for UPSC preparation: syllabus, sessions, goals, practice, tests, revision, and reports. The complete React/TypeScript source is in `app/`; the built website is at this repository's root.

## PYQ practice

The [PYQ section](https://arsenalhero.github.io/upsc-command-center/#/pyqs) includes 220 questions: complete Prelims GS-I Set A papers from 2024 and 2025, and the complete 2025 Mains GS-II paper. Browse by subject or year, run a timed practice set, resume a saved draft, filter wrong answers or revision flags, and export full attempt history. Every submitted attempt keeps the selected answer, marking basis, active time, confidence, difficulty, mistake category and review notes. Repeat attempts remain separate.

2024 Prelims uses the UPSC answer key; its three dropped questions are excluded from accuracy. The 2025 Prelims key is not connected in this version, so those results are explicitly unmarked or self-assessed. Mains supports written answers and optional self-assessed marks. Prelims practice displays the original paper images, with an OCR transcript for search/accessibility. Other years and papers are not yet included. See [sources and data rules](app/docs/PYQS.md).

## Account pages

- [Log in](https://arsenalhero.github.io/upsc-command-center/#/login)
- [Sign up](https://arsenalhero.github.io/upsc-command-center/#/signup)
- [Reset password](https://arsenalhero.github.io/upsc-command-center/#/forgot-password)

**Real accounts and cloud sync are not activated yet.** The backend configuration is currently empty. Account forms are disabled until a Supabase project is configured. Guest tracking continues to work, and existing device records are preserved.

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

The test suite includes analytics/validation/storage checks, PYQ paper completeness and grading, timer accounting, backups and exports, account cache isolation, failed-save retry, serialized writes, captured owner tokens, and actual PostgreSQL migration/permission tests with PGlite. Auth UI tests use the real Supabase SDK against a simulated API and cover signup, confirmation/resend, recovery callbacks, password changes, login/logout, study sync, and two-user isolation. PYQ UI tests cover subject/year filters, real-paper image references, hidden-tab timing, official marking, resumed drafts, review notes, skips, repeat history and Mains writing.

These checks do not establish live Supabase setup or email delivery. Real browser visual checks and public signup/recovery checks remain part of activation. See [verification notes](app/docs/VERIFICATION-RESULTS.md) and [full app guide](app/README.md).
