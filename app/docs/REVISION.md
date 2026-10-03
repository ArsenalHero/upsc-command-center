# Revision and spaced repetition

The Revision planner includes a calendar, daily agenda, overdue/today/upcoming totals and completed history. Schedule a topic manually or use a study session's next-revision date. Optional spaced repetition adds the next review automatically when a revision is completed.

## Use spaced repetition

1. Open Revision and select **On** under Spaced repetition.
2. Enter **Repeat after** as a whole number from 1 to 365 days.
3. Select **Save settings**. The card shows the saved interval.
4. Complete a scheduled revision. The same topic is scheduled again after the chosen interval, calculated from its actual completion date, and appears in the calendar with a Spaced repetition badge.

For example, completing a revision on 3 October with a seven-day interval creates a pending review for 10 October. A late completion still uses the completion date. Intervals are calendar days in the user's browser timezone and handle month/year boundaries and leap days.

The preference defaults to Off, including for older workspaces. Turning it off stops generating subsequent repeats while keeping existing schedules. Editing the interval affects the next completion and preserves dates already scheduled. Enabling repetition does not backfill historical completions or change pending reviews. Repetition is a saved calendar entry created at completion, so a timer or open page is not required on the due day.

## History and duplicate prevention

The completed revision keeps its original due date, actual completion date, topic, learning stage and notes. A repeat copies the topic, subject, stage and plan, uses a fresh ID, and stores its source revision ID in `repeatOf`. Repetition does not automatically declare that a topic has reached mastery.

Completing the same record again or editing its completed date/notes does not create another repeat. An existing pending revision for the same topic, subject and due date is reused. The completion and next schedule are saved together; a storage failure applies neither, and the user can retry. Saving a pending revision's completed date through the record editor uses the same scheduling behavior.

## Saved data

The optional `settings.spacedRepetition` object stores `{ enabled, days }` in the existing personal workspace. Version-1 backups without the field remain readable and behave as Off. Account workspaces use their existing persistence path; this feature changes no authentication or database permissions.

JSON backups retain the preference and all revision records. Revision CSV exports include the source link when repeat records exist. Deleted source records do not invalidate a surviving review's backup. No new backend job, notification permission, paid service or schema migration is required.

## Verification

Unit checks cover actual completion dates, calendar boundaries, interval changes, disabling, repeated completion, reused manual schedules, legacy workspaces, backup/export preservation and invalid intervals. The rendered React check covers radio controls, custom intervals, calendar visibility, saved preferences after reload, completion through both the agenda and editor, edits of completed records and atomic failure/retry.
