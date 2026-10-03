# Verification results

Verified in the build environment on 2026-10-03:

| Check | Result |
|---|---|
| Full TypeScript app (`npm run typecheck`) | Passed |
| Analytics/storage/auth/cache/validation/Postgres/PYQ tests | 38 passed, 0 failed |
| Real React app rendered in JSDOM (`npm run test:ui`) | All three suites passed |
| First-time setup, empty state, demo mode and all 19 routes | Passed in rendered UI |
| Report periods, study form persistence and fresh-DOM restoration | Passed in rendered UI |
| Active bank scope and complete Booklet A numbering | 2025 only: GS I 100 + CSAT II 80 |
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
| Real Auth SDK and cloud flows against a simulated API | Passed; signup, recovery, login/logout, study/PYQ sync, cache cleanup and two-user isolation |
| Actual Postgres migration and permissions in local PGlite | Passed; anonymous rejection, row isolation, authorized writes and conflicts |
| Production build and lazy imports (`npm run build`) | Passed |
| Built HTML asset references, manifest icons and service-worker syntax | Passed |
| HashRouter and relative Vite base | Confirmed in source and production references |
| Real browser screenshots and responsive geometry | Not executed; DOM tests do not verify visual layout |
| Browser download UI, PWA installation/offline upgrade | Not executed |
| Live Supabase accounts and email delivery | Not activated; the public auth configuration is empty |
| Optional WebMCP in a supported real browser context | Not executed |

These results distinguish functional DOM checks from browser visual verification. Responsive CSS is present, but desktop/mobile screenshots have not been inspected. See [QA.md](QA.md) for remaining browser checks.

The frontend is linked to `ArsenalHero/upsc-command-center` on GitHub Pages. The release is checked against the repository's Pages deployment after publication. Authentication remains disabled while `auth-config.json` is empty; a configured Supabase project, database migration, redirect URLs and public email delivery are needed to activate it. No live Supabase schema or auth setting was changed by this 2025-only update.
