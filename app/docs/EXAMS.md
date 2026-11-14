# Personal workspace exams

Select the **Personal workspace** button in the sidebar to open **Choose your workspace exam**. Choose UPSC CSE or State PSC and select **Save exam**. Equivalent fields are available in the setup wizard and Preparation settings; Settings requires **Save settings**.

UPSC CSE uses a target year and separate Prelims and Mains dates. For 2027, the supplied defaults are 23 May 2027 and 20 August 2027. Both are editable. Older 2027 workspaces with blank dates display these defaults; any personally entered nonempty date takes precedence. Changing the year replaces matching default dates, preserves other personally entered dates, and leaves unknown years blank. These defaults are not a live official-calendar subscription.

State PSC requires the user's exam name (up to 120 characters) and exam date. Names are free text so any commission or exam stage can be entered. The dashboard shows that selected target and its date instead of CSE countdowns. Switching back to CSE retains the saved State PSC name/date and study history. Switching to State PSC retains the CSE year/dates.

## Countdown behavior

The dashboard counts days, hours, minutes and seconds, updating once a second from the actual clock. It targets **00:00 IST on the selected exam date**. A date alone does not identify an exam session start time. Explicit `+05:30` conversion makes the same target apply when the user's browser is in another timezone. Past dates clamp to zero and show that the exam date has arrived; missing dates prompt the user to configure them.

Only the countdown component updates each second; analytics do not rerun on every tick. Its interval is removed when leaving the dashboard. Reopening a backgrounded page recalculates from the current clock instead of subtracting guessed elapsed ticks. The timer is visual and creates no backend job or notification.

## Persistence and verification

Optional `settings.examType`, `settings.statePscName` and `settings.statePscDate` are part of the existing private workspace JSON. Backups without these fields remain compatible and use CSE. No authentication, permissions or schema changes are required. Exported report targets use the selected exam label.

Unit checks verify date defaults/overrides, year switches, State PSC persistence, legacy backups, validation, IST boundaries, second decomposition and expired/invalid dates. The rendered React check verifies State PSC setup, personal workspace selection, name/date fields, dashboard replacement, one-second updates, editable CSE defaults, reload, Settings edits, cancelled edits and timer cleanup.
