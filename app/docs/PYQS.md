# 2025 Prelims PYQ practice

The active bank contains only UPSC CSE Prelims 2025: GS Paper I (100 questions) and CSAT Paper II (80 questions), English, Booklet A. Existing records from earlier years and Mains remain in History, dashboards and exports. Older `pyqDraft` and version-1 backups remain readable; new sessions use the optional `prelims` workspace field.

Questions are selectable text. Statements are semantic lists, ten GS matching questions are HTML tables, and all 29 CSAT comprehension items include their complete shared passage. No question images are displayed. Original numbering, options and mathematical symbols were checked against the original English paper pages. Subject/topic/subtopic and difficulty tags are editorial study classifications, not official UPSC metadata.

## Sources and answer keys

- GS original: https://www.upsc.gov.in/sites/default/files/QP-CSP-25-GENERAL-STUDIES-PAPER-I-26052025.pdf
- CSAT original-paper mirror: https://www.shankariasacademy.com/pdf/Upsc-Qus-Papers/UPSC-Prelims-2025-PAPER-II.pdf
- GS official-key PDF mirror: https://forumias.com/blog/wp-content/uploads/2026/05/UPSC-2025-Answerkey-GS-I.pdf
- CSAT official-key PDF mirror: https://forumias.com/blog/wp-content/uploads/2026/05/UPSC-2025-Answerkey-CSAT-1.pdf

Verification file digests (SHA-256):

| Source PDF | SHA-256 |
|---|---|
| GS paper | `740c5046d191db8e3a10beb053ea369c581d1ca97d0629b80b42c8982b29a98b` |
| CSAT paper | `7f958efa436f4ff593f87e75c323a6d2418f61b666863379e4c7921985694819` |
| GS key | `374538e0ce62a6128c6b089bfb8f6bbba04a225cf59d89a52d2df519c8827eef` |
| CSAT key | `53bac4b4821fe3d71ebb3875654e1d16d6e4dc4ef75e4f99291006e254ead9df` |

Both mirrored keys are the UPSC Series A tables, visually checked against their cover/table pages. All 180 questions have official answers; neither Series A table lists a dropped question. Marking is GS +2 and −2/3, CSAT +2.5 and −2.5/3, blank 0. Penalties retain full precision until display. One right and three wrong cancel out in either paper.

There are 89 checked editorial study explanations: all 80 CSAT items and nine GS items. References identify the original passage/problem or a verified primary source. The other 91 GS explanations say **verification required**; the official answer remains available. These are editorial study notes, not solutions published by UPSC. Do not invent reasoning, reference sections, or NCERT page numbers to fill missing explanations.

## Practice and tests

Browse with combined paper, subject, topic, subtopic, difficulty, status and text filters. The year is fixed to 2025. Practice a filtered set, shuffle it, or select one question. Full papers retain original order and contain 100 GS or 80 CSAT questions. Test mode hides answers, explanations and key links until final submission. A 2-hour deadline is optional for full-paper tests and continues while the page is hidden or the active timer is paused.

Individual-question practice starts at that question and continues in original order within its paper and subject/topic/difficulty filters. The search and latest-result filters locate the starting question rather than reducing this continuous session to one item. Next question is available beside feedback and in the sticky footer; the optional automatic-advance preference is saved in the workspace. Practice submission locks the choice and its active time; metadata remains editable. Going back does not change the result. Skipping records time with a blank answer and zero marks. Test choices remain editable drafts until final submission. The question palette shows answered, visited, unseen and review states. A current session must be resumed and finished before another starts, so draft answers are not silently replaced.

The per-question active timer uses a monotonic clock, pauses on hidden tabs, flushes before navigation/exit and checkpoints every ten seconds. Hidden/closed time is excluded from active time. Reload restores answers, confidence, notes, flags, position and recorded seconds. A timed session resumed after its deadline is finalized before allowing edits. Browser shutdown can lose at most the interval since the last checkpoint if lifecycle events never fire.

## Personal data and reports

Saved attempt records retain stable question ID, year, stage, paper, original number/booklet, source, session and mode, submission timestamp, choice, key snapshot, outcome, active seconds, confidence, mistake category, notes, difficulty and revision flag. Repeat attempts append new records. Post-submission review edits preserve scored fields and times. Failed storage writes do not advance the session or reveal feedback; quota errors remain visible for retry.

Reports show attempted/right/wrong/unattempted totals, raw marks, penalty, final score, accuracy, active time and subject/topic/difficulty breakdowns, plus per-question review. Completed reports freeze the key used for scoring. Revision includes latest mistakes, skips, bookmarks, review flags, repeat mistakes and weak topics (latest-attempt accuracy below 60%). CSAT reports for complete papers show the 66/200 practice benchmark. No rank or percentile is fabricated without cohort data.

Guest progress is browser-local. Configured accounts use the existing account-isolated repository and RLS-protected JSON workspace. The public site's auth configuration remains empty until Supabase is activated; this release does not claim that public signup or cross-device sync is enabled. See [ACCOUNTS.md](ACCOUNTS.md). No service-role key belongs in a public build.

JSON backups include sessions, completed reports, bookmarks, review flags, existing drafts and all historical records. Attempt CSV exports retain question parameters. Active public bank content is not copied into private workspace payloads, apart from the saved question text and source already required for history.

## Maintaining the bank

Edit `src/data/pyq-bank.json`. Preserve existing question IDs. Check every number, option, matching cell, continuation, formula and passage against the original PDF and compare answers to the same booklet's official key. Keep incomplete reasoning explicitly flagged. The integrity tests cover exactly 2025/100+80, valid options/keys, text blocks and representative scan-sensitive symbols. Old image assets are retained for cached clients but are not used by this page.
