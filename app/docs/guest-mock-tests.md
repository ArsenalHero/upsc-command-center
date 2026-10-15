# Guest mock tests

Mock tests no longer require account login. The existing license-key check applies to both guests and accounts. Guests can start immediately without a display-name form, save answers, resume after a reload, submit, download a summary, and reopen reports, explanations and recall sheets. History, bookmarks and mistake review also work for guests.

Guest progress belongs to the browser session. Clearing browser storage loses access; signing into an account opens that account's separate history. Guests receive practice scores and community benchmarks. Account first attempts retain their existing ranking rules; guest sessions cannot create ranked attempts.

## Server boundaries

- A browser creates a 256-bit bearer token with Web Crypto. It is sent only in mock RPC request bodies, never in URLs, downloads or workspace records. The database stores its SHA-256 hash.
- `mock_private.participants` owns mock profiles and attempts. Existing account IDs and records are backfilled unchanged. Account deletion still cascades through the participant relation. No guest Supabase Auth accounts are created, and workspace login and sync are unchanged.
- The checked RPC validates either the real account session or the guest token plus current license version. Invalid account sessions cannot fall back to guest access. Account requests ignore guest tokens.
- Guest license verification retains the ten-failed-checks-per-minute limit. License rotation invalidates guest grants while preserving attempts for re-verification.
- Private tables retain RLS and no direct client grants. Existing server scoring, answer redaction, deadlines, save sequence checks, ownership checks and administrator checks apply to guests too.

Apply `supabase/migrations/202610150001_guest_mock_attempts.sql` to an existing database before deploying the frontend. `supabase/sql/mock-lab.sql` contains the matching fresh-install definitions.

## Verification

`tests/mock-guest.test.ts` checks the real Postgres API with separate guest tokens, account isolation, key throttling and rotation, server scoring, answer redaction and guest exclusion from rankings. Existing mock backend tests exercise account grants, expiry, revoked sessions, ownership and ranking rules. `tests/mock-ui-check.mjs` runs the actual React app and Auth SDK against Postgres-backed requests, including guest start, a complete app reload, resume, submission, explanations, recall sheets and the existing account workflow.
