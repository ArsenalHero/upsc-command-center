# Guest names and visit greetings

Guest entry asks only for a name and replaces the six-step guest setup. Existing settings and preparation records are preserved. Account setup remains available to signed-in users.

The centered welcome dialog uses the guest's saved browser name or the signed-in account's existing display name. It shows a greeting for the browser's local time and one of ten original study encouragements. Guests can change their name in the welcome dialog. Names support Unicode and are limited to 60 characters.

A new document load, new tab, or restoration from the browser's back/forward cache shows the welcome again. Normal page navigation and tab-focus changes do not reopen it. Quote selection advances between visits. Account setup and the welcome dialog do not overlap.

Guest names use `upsc-guest-profile:v1` in local storage, with session storage and in-memory fallback when needed. They remain separate from study backups, account records, mock bearer tokens and Supabase Auth users. Clearing browser storage removes the saved guest name. A known name restores guest entry on a fresh tab without requiring login.

Run `npm run test:welcome` for storage, Unicode, quote rotation, guest onboarding, reopening, account-name isolation, cancellation and history-preservation checks. The shared modal component supplies centering, keyboard dismissal and focus restoration.
