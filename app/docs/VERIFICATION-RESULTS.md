# Verification results

Verified in the build environment on 2026-10-02:

| Check | Result |
|---|---|
| Dependency installation (`npm install`) | Passed |
| Full TypeScript app (`npm run typecheck`) | Passed |
| Analytics/storage/auth/cache/validation/Postgres tests | 26 passed, 0 failed |
| Real React app rendered in JSDOM | Passed |
| First-time setup and actionable empty state | Passed in rendered UI |
| Fictional demo loading and mode label | Passed in rendered UI |
| All 19 route headings and page rendering | Passed in rendered UI |
| Daily/weekly/monthly/quarterly/yearly report tabs | Passed in rendered UI |
| Study form mutation persisted to LocalStorage | Passed in rendered UI |
| Restoration into a fresh DOM from saved data | Passed |
| Production build and lazy imports (`npm run build`) | Passed |
| Built HTML asset references and manifest icons | All present |
| Generated service-worker JavaScript syntax | Passed |
| HashRouter and relative Vite base | Confirmed in source and production references |
| 10,000-session aggregate + 14-subject health calculation | Approximately 70 ms in this environment |
| Real browser screenshots and responsive geometry | Unavailable: browser-preview infrastructure not present |
| Browser download UI, PWA installation/offline upgrade | Not executed in this environment |
| Real Auth SDK and cloud flows against a simulated API | Passed; signup, resend, recovery, login, logout, study sync, cache cleanup, and two-user isolation |
| Actual Postgres migration and permissions | Passed locally with PGlite; anonymous rejection, row isolation, authorized writes, and conflicts |
| Live Supabase accounts and email delivery | Not activated; no backend project connected |
| Optional WebMCP in a supported real browser context | Unavailable |

These results distinguish functional DOM checks from browser visual verification. The app has responsive layout rules, but this document does not claim that desktop/mobile screenshots were inspected. Follow `docs/QA.md` for the remaining browser checks.

The frontend is linked to ArsenalHero/upsc-command-center on GitHub Pages. Deployment completion is checked in the repository's Pages workflow. Authentication remains disabled while auth-config.json is empty; a configured Supabase project, database migration, redirect URLs, and public email delivery are needed to activate it.
