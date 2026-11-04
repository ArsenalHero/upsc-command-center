# Aurum

Open **Golden Gate → Aurum** (`#/tests/prelims/aurum`) after the existing license verification. Choose PYQs, mock questions, or both; select one or multiple subjects and a whole-number count from 1 to 100. The displayed availability counts unique, unused questions in the selected pool. A mixed set includes both sources when at least two distinct questions from the two sources are available. Source overlaps count once. Only MCQs with a usable answer key enter the PYQ pool.

Practice is untimed. Check or skip each question to reveal its key and supplied explanation. Checked responses are final. Save & leave, then Resume practice, to continue at the next unanswered question. Finishing early marks the remaining questions skipped. The completion summary and latest-set review remain available.

## Permanent exclusion

`mock_private.aurum_seen` reserves all questions atomically at set creation. It is independent of subject/source filters and never resets automatically. SHA-256 identities normalize wording and sorted option text so punctuation, whitespace, casing and option order do not create fresh copies. Stable origin/source IDs also protect against repeated practice after wording corrections. Skipped questions and questions in unfinished sets stay reserved. Use Resume practice to return to the existing set.

Every owner can have one running set. An owner-scoped advisory lock and unique indexes protect concurrent starts across tabs/devices. A client-generated request UUID makes lost-reply retries idempotent, including after completion. Responses are saved under a session row lock; retries cannot change a checked answer.

Account participants keep the same history on every device. Guests use the existing private Golden Gate browser token, and clearing browser storage loses access to that guest history. Account and guest histories are separate. No browser-only fallback silently starts repeatable sets when the service is unavailable.

## Backend setup

For an existing Golden Gate deployment, apply `supabase/migrations/20261104031926_aurum_subject_practice.sql`, then `supabase/migrations/20261104045009_aurum_fast_setup.sql` before publishing the frontend. For a fresh install, run `supabase/sql/mock-lab.sql` first, then both Aurum migrations. The migrations are idempotent and check their dispatcher anchors. Existing sessions, exclusions, license verification, account/session validation, guest authorization, mock attempts and rankings stay intact.

The session, exclusion and catalogue tables live in the private schema, have RLS enabled and no client table grants. Their helper functions have no client EXECUTE grants. All Aurum operations are dispatched through the existing checked `mock_lab` RPC after the license/session boundary. Owner identity comes from that boundary, never request JSON. Unchecked question answers and explanations are stripped.

PYQ snapshots come from the existing reviewed/canonical source bank. Run `node --import tsx scripts/prepare-aurum-catalog.ts /path/to/output` from `app/` and apply every generated SQL batch with administrator access. Upserts preserve learner history. Run the preparation again when the reviewed PYQ bank changes. Mock metadata is indexed automatically on test insertion/question edits; schedule/status visibility is checked at query time.

The browser requests `aurum-catalog` for counts and small session previews, then sends only filters/count to `aurum-start-v2`. Selection and answer keys come from the private server catalogue. Only the selected set's question bodies are returned. The legacy operations remain compatible with already-open older clients. Aurum sessions never enter mock leaderboards, official attempts, or mock summary statistics.

## Loading and layout

Setup no longer downloads, parses or hashes the full question bank, transfers thousands of mock references, or fetches complete previous sessions. Freshness checks use the existing indexed exclusion ledger. Rapid subject changes are debounced, per-selection metadata is cached during setup, and stale responses cannot overwrite the current selection. The form renders immediately with a small subject skeleton; resume/review loads its question bodies on demand.

Source choices and subject rows explicitly override the app's default vertical label direction. Desktop uses compact subject columns, a bounded workspace and a smaller gold summary; mobile uses two subject columns and a full-width start action. Controls remain native radio buttons/checkboxes with focus states and reduced-motion support.

The 4 November 2026 check used 9,015 keyed PYQs and 10,110 indexed mock entries. Database execution for an empty-history setup fell from 3,451.8 ms to 236.4 ms, and the JSON response from 3,202,763 to 1,344 bytes. Estimated gzip size of the initial Aurum JavaScript graph fell from 4,312,512 to 184,060 bytes (23,774,796 to 592,347 bytes before compression). These measure the catalogue query and code payload, not total browser load time or a network-speed guarantee. Live rollback-only tests verified mixed selection, answer redaction/scoring, compact resume previews and 20 unique reservations across consecutive sets; all 9,015 PYQ fingerprints match their stored snapshots.

## Verification

`npm --workspace app run test:aurum` runs content/source/subject/count checks and actual PostgreSQL tests for private ownership, account/guest isolation, license enforcement, hidden answers, atomic reservations, idempotent starts/answers, skipped/abandoned sets and exhausted pools. It also verifies compact catalogue payloads, server-owned selection, cross-source deduplication, automatic mock indexing and schedule visibility. The React UI test uses PostgreSQL-backed RPCs, checks horizontal styles against the global label rule, verifies controls render before data, and exercises count validation, retries, reload/resume and non-repeating later sets. The production performance check forbids question-library imports on Aurum setup and caps its JavaScript shell size.

Run `npm run build` at the repository root and commit the generated Pages output together with source changes. Browser geometry/screenshot QA requires the managed preview service; DOM interaction tests do not simulate geometry.
