# Lecture workspace

The Lectures tab lives in the Workspace navigation at `#/lectures`. Choose an existing or custom subject and set its total lecture target. One target per subject keeps totals unambiguous. A course/teacher name, daily target (zero means no daily target) and finish date are optional. Existing study records and PYQ attempts stay separate.

Log **the day's total completed lectures**, with optional minutes and notes. There is one entry per subject plan and calendar date. Opening an already recorded day loads its saved values; saving replaces that day's total rather than adding another duplicate. Edit or delete a daily entry from History. Editing a target retains the existing daily logs.

The overview shows total target, actual completed, remaining and completions on the selected day. Completion progress caps each subject independently before aggregation: extra History lectures cannot satisfy an unfinished Geography target. The daily bars and activity calendar open the chosen day's log. Totals include entries through that date, using the browser's local calendar day. The streak can continue through yesterday. Deadline pace is the remaining count divided by available calendar days, rounded up; it is a planning calculation, not a prediction.

Minutes remain lecture-specific and do not automatically create duplicate Daily Study sessions. The completion ring, subject cards, daily bars and 28-day calendar include accessible labels and exact counts. Empty workspaces show zero totals and an action to set the first target.

Targets and logs are the optional `lectures` field in the existing version-1 private workspace. Older backups without it remain valid. Writes validate subject references, whole-number targets/counts, real calendar dates, unique identifiers and unique subject/day pairs. Storage failure retains the form for retry. Configured accounts use the existing owner-isolated JSON repository; public cloud accounts remain disabled until Supabase is configured.

Full JSON backups include all lecture targets and logs. The Lecture CSV button exports daily rows with subject, course, target, daily target, deadline, count, minutes and notes; formula-like cells are escaped. A target with no logged day is retained in JSON.

Verification covers aggregate arithmetic, separate subject targets, empty calendar days, subject filters, whole-number/date checks, backups and CSV safety, real rendered forms, same-day updates, refreshed data, failed storage recovery and two-account isolation through the simulated Auth API.
