# Revision and spaced repetition

The Revision planner includes a calendar, daily agenda, overdue/today/upcoming totals and completed history. Schedule a topic manually or use a study session's next-revision date. Optional spaced repetition adds the next review automatically when a revision is completed.

## Use spaced repetition

1. Open Revision and select **On · 1–7–14–30–90** for the preset, or **Custom** to enter your own interval of 1–365 whole days.
2. Select **Save settings**. The card shows the saved preset or interval.
3. Complete a scheduled revision. The same topic is scheduled again automatically and appears in the calendar with a Spaced repetition badge.

The preset creates five successive reviews, targeting days 1, 7, 14, 30 and 90 after the first completion. It queues one next review at a time and finishes after the fifth review. The gaps are 1, 6, 7, 16 and 60 calendar days. Each gap is measured from the actual previous completion: late or early completions shift the remaining timeline, so no next review is created in the past. A pending preset entry shows its review number out of five. Switching to Custom continues with the selected interval; switching back starts a fresh preset from the next completed custom entry.

This is a fixed preset, not a claim that these exact intervals are optimal for every learner. Research supports spaced study and finds that optimal gaps vary with the retention horizon: [Cepeda et al. (2008)](https://www.yorku.ca/ncepeda/publications/CVRWP2008.html).

For example, Custom with seven days creates a 10 October review after a 3 October completion. The preset instead creates 4 October, then (if completed on time) 10 October, 17 October, 2 November and 1 January. Intervals are calendar days in the user's browser timezone and handle month/year boundaries and leap days.

The preference defaults to Off, including for older workspaces. Turning it off stops generating subsequent repeats while keeping existing schedules. Editing the interval affects the next completion and preserves dates already scheduled. Enabling repetition does not backfill historical completions or change pending reviews. Repetition is a saved calendar entry created at completion, so a timer or open page is not required on the due day.

## History and duplicate prevention

The completed revision keeps its original due date, actual completion date, topic, learning stage and notes. A repeat copies the topic, subject, stage and plan, uses a fresh ID, and stores its source revision ID in `repeatOf`. Repetition does not automatically declare that a topic has reached mastery.

Completing the same record again or editing its completed date/notes does not create another repeat. An existing pending revision for the same topic, subject and due date is reused. The completion and next schedule are saved together; a storage failure applies neither, and the user can retry. Saving a pending revision's completed date through the record editor uses the same scheduling behavior.

## Saved data

The optional `settings.spacedRepetition` object stores `{ enabled, days, mode }` in the existing personal workspace. The optional mode is `preset` or `custom`. Version-1 backups without the object remain readable and behave as Off; older enabled settings without a mode retain their custom interval. Preset reviews store `repetitionStep` from 0 to 4. Account workspaces use their existing persistence path; this feature changes no authentication or database permissions.

JSON backups retain the preference and all revision records. Revision CSV exports include the source link when repeat records exist. Deleted source records do not invalidate a surviving review's backup. No new backend job, notification permission, paid service or schema migration is required.

## Verification

Unit checks cover the whole finite preset, late completions, preset/custom switches, actual completion dates, calendar boundaries, disabling, duplicates, reused manual schedules, legacy workspaces, backup/export preservation and invalid intervals/steps. The rendered React check covers all three radio choices, preset and custom scheduling, calendar visibility, saved preferences after reload, completion through both the agenda and editor, edits of completed records and atomic failure/retry.
