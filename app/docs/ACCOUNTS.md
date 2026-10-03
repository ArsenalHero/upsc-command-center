# Accounts and private study records

The frontend stays on GitHub Pages. Supabase provides password authentication and a Postgres database. The deployed configuration is connected to the Free-plan `upsc-command-center` project in Mumbai. The private workspace migration is applied, and live database permissions reject anonymous access. Website redirects and public email delivery are still pending dashboard configuration; real signup, delivered confirmation, recovery and two-device account tests have not been completed. Guest tracking remains available. No passwords are stored by the app's study-data repository.

## Activate a project

1. Create or select a Supabase project that you control. Apply `supabase/migrations/202610020001_private_workspaces.sql` once, using the SQL editor or the Supabase migration tooling.
2. Enable the email/password provider and public signups in Authentication. Use email confirmation and a password minimum of at least 8 characters.
3. Set the Site URL to `https://arsenalhero.github.io/upsc-command-center/`. Add these exact redirect URLs:

   - `https://arsenalhero.github.io/upsc-command-center/?auth=confirm`
   - `https://arsenalhero.github.io/upsc-command-center/?auth=recovery`

   Add localhost development redirects separately only if you need them. The project path must remain in all redirect URLs.
4. Configure custom SMTP for signup confirmation and password recovery emails to public visitors. Supabase's default mail sender only delivers to members of the project team; it is insufficient for a public signup page. Keep SMTP passwords in Supabase's private configuration, never in the frontend or this repository.
5. The default confirmation and recovery templates containing `{{ .ConfirmationURL }}` work with this client-side app. It also supports cross-device token-hash links if you customize the templates:

   ```html
   <!-- Confirm signup -->
   <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   <!-- Recover password -->
   <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
   ```

6. Put the project URL and **publishable** key into `public/auth-config.json`:

   ```json
   { "url": "https://YOUR_PROJECT.supabase.co", "publishableKey": "YOUR_PUBLISHABLE_KEY" }
   ```

   Legacy keys with the `anon` role also work. Secret keys and `service_role` keys are rejected by the client and must never appear in a GitHub Pages build. Alternatively, use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in an uncommitted `.env.local` before building. Both values are public browser configuration; neither replaces database access policies.
7. Build and publish the frontend. In the linked repository, source is in `app/`; run `npm ci` and `npm run build` at the repository root, then commit the updated source and generated Pages files together. To activate a prebuilt frontend without rebuilding, update both `app/public/auth-config.json` and the root `auth-config.json` with the same public values. Account configuration is deliberately excluded from service-worker caching.
8. Test with two real email addresses: signup, delivered confirmation, login, creating a study session, logging out, restoring on another device, and recovery email delivery. Confirm the second account cannot read or change the first one's records. Do not call public account setup complete until these live checks pass.

## Privacy and persistence

- The database has one `study_workspaces` row per authenticated user. Its JSON includes settings, subjects, syllabus topics, all practice/study records, resources, and goals.
- The table uses row-level security. Only `authenticated` users can SELECT their own row; anonymous users have no table access. Direct client INSERT/UPDATE/DELETE are revoked. The public save RPC uses caller privileges and delegates to an authenticated-only writer in the non-exposed `workspace_private` schema. That writer derives ownership from `auth.uid()` and takes no user ID from the browser.
- Every save includes the last acknowledged revision. A stale save fails instead of overwriting another device's work. The Account page lets the student export pending records and explicitly load the latest cloud copy.
- Pending edits are stored under an account-specific browser key, then uploaded serially. A successful authenticated cloud read is required before an account cache can be displayed. No private cached records appear after an unauthenticated/failed load.
- Requests capture the original account's bearer token and stop after the workspace closes, so switching accounts cannot send the previous user's records under the new user's session.
- Manual signout waits for syncing and clears that account's browser cache. If syncing fails, the app offers a backup and an explicit discard confirmation. Signing out here ends this device's session.
- Guest data stays under the original `upsc-command-center:v1` key and remains separate. Importing guest data into an account requires confirmation and replaces the account workspace; it does not silently merge or move another browser user's guest data.
- Private workspaces require an online authenticated load. Previously loaded guest data remains available offline. Account edits made before a connection failure stay pending on that device; users should export a backup before discarding them.
- The account workspace limit is 8 MB. Backups and CSV export remain available.

## Verification

`npm test` covers cache separation, failed saves, restore/retry, sequential writes, stale revisions, closed-account writes, captured tokens, configuration/key validation, and project-path auth redirects. It also runs the actual migration in a local PostgreSQL engine (PGlite), testing anonymous access rejection, two-user row isolation, write permissions, and revision conflicts.

`npm run test:ui` runs the React app and the real Supabase Auth SDK in JSDOM against a simulated API: signup/confirmation UI, resend, forgot password, invalid login, login/logout, study syncing, cache cleanup, and two separate accounts. These tests do not establish live email delivery or actual Supabase project configuration, and they do not replace browser visual checks.

Official references: [password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [SMTP delivery](https://supabase.com/docs/guides/auth/auth-smtp), and [browser API keys](https://supabase.com/docs/guides/api/api-keys).
