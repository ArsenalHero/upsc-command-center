# Aurum

Open **Golden Gate → Aurum** (`#/tests/prelims/aurum`) after the existing license verification. Choose PYQs, mock questions, or both; select one or multiple subjects and a whole-number count from 1 to 100. The displayed availability counts unique, unused questions in the selected pool. A mixed set includes both sources when at least two distinct questions from the two sources are available. Source overlaps count once. Only MCQs with a usable answer key enter the PYQ pool.

Practice is untimed. Check or skip each question to reveal its key and supplied explanation. Checked responses are final. Save & leave, then Resume practice, to continue at the next unanswered question. Finishing early marks the remaining questions skipped. The completion summary and latest-set review remain available.

## Permanent exclusion

`mock_private.aurum_seen` reserves all questions atomically at set creation. It is independent of subject/source filters and never resets automatically. SHA-256 identities normalize wording and sorted option text so punctuation, whitespace, casing and option order do not create fresh copies. Stable origin/source IDs also protect against repeated practice after wording corrections. Skipped questions and questions in unfinished sets stay reserved. Use Resume practice to return to the existing set.

Every owner can have one running set. An owner-scoped advisory lock and unique indexes protect concurrent starts across tabs/devices. A client-generated request UUID makes lost-reply retries idempotent, including after completion. Responses are saved under a session row lock; retries cannot change a checked answer.

Account participants keep the same history on every device. Guests use the existing private Golden Gate browser token, and clearing browser storage loses access to that guest history. Account and guest histories are separate. No browser-only fallback silently starts repeatable sets when the service is unavailable.

## Backend setup

For an existing Golden Gate deployment, apply `supabase/migrations/20261104031926_aurum_subject_practice.sql` before publishing the frontend. For a fresh install, run `supabase/sql/mock-lab.sql` first, then the Aurum migration. The migration is idempotent and checks its dispatcher anchor before changing the existing API. It leaves license verification, account/session validation, guest authorization, mock attempts and rankings intact.

The two new tables live in the private schema, have RLS enabled and no client table grants. Their helper functions have no client EXECUTE grants. All Aurum operations are dispatched through the existing checked `mock_lab` RPC after the license/session boundary. Owner identity comes from that boundary, never request JSON. Unchecked question answers and explanations are stripped; mock inventories contain identifiers/subjects only, without question text or keys.

PYQ snapshots come from the existing public reviewed/canonical question bank. Their client-supplied keys are used solely for unranked Aurum practice. Mock questions and their keys are loaded from private server records. Aurum sessions never enter mock leaderboards, official attempts, or mock summary statistics. New PYQ banks need no database seeding step.

## Verification

`npm --workspace app run test:aurum` runs content/source/subject/count checks and actual PostgreSQL tests for private ownership, account/guest isolation, license enforcement, hidden answers, atomic reservations, idempotent starts/answers, skipped/abandoned sets and exhausted pools. Its React UI test uses a PostgreSQL-backed RPC, verifies both source modes and multi-subject selection, simulates a failed answer save, completely reloads the app, resumes practice and creates another non-repeating set. The UI test is also included in `npm run test:ui`.

Run `npm run build` at the repository root and commit the generated Pages output together with source changes. Browser geometry/screenshot QA requires the managed preview service; DOM interaction tests do not simulate geometry.
