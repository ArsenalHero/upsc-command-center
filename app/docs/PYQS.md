# PYQ question bank

The active bank contains 2,206 unique entries: the complete UPSC CSE Prelims 2025 GS Paper I (100 questions) and CSAT Paper II (80 questions), all 1,173 questions from nine user-supplied Polity text files, and all 853 questions present in six user-supplied Geography files. Existing records from earlier years and written Mains remain in History, dashboards and exports. Older `pyqDraft` and version-1 backups remain readable; new sessions use the optional `prelims` workspace field.

## Uploaded Polity coverage

| Source | Questions |
|---|---:|
| Polity1.txt | 143 |
| POL2.txt | 206 |
| POL3.txt | 71 |
| POL4.txt | 100 |
| POL5.txt | 154 |
| POL6.txt | 240 |
| POL7.txt | 63 |
| POL8.txt | 98 |
| POL9.txt | 98 |
| Total unique source entries | 1,173 |

Collections contain 272 uploaded UPSC CSE questions, 571 State PSC questions, 330 CDS/CAPF questions and one Unlabelled question. These membership counts overlap once: POL8 Q47 is labelled UPPCS Mains 2004 and UPSC CSE Prelims 2001. It has one stable question ID, appears under both labelled exams and matches the year of the selected occurrence. Polity1 Q38 retains both MPPSC years, 2010 and 1998. POL8 Q54 retains both UPPSC exam labels. POL2 Q67 has no supplied exam/year and remains Unlabelled, displayed as “Not supplied”; its CSV year is blank.

The State PSC collection includes Uttar Pradesh, Bihar, Madhya Pradesh, Rajasthan, Jharkhand, Uttarakhand and Chhattisgarh, with individual exam and stage filters. Source labels are preserved alongside normalized exam names. English/Hindi question text, every option, the marked answer and each explanation were audited against all nine uploaded files. There are 31 questions with five options, including six answers marked E. Objective items labelled Mains remain MCQs and retain their source stage; they are not converted into essay tasks.

## Uploaded Geography coverage

| Source | Questions | Source numbering gaps |
|---|---:|---|
| GEO1.txt | 101 | None |
| GEO2.txt | 120 | None |
| GEO3.txt | 44 | None |
| GEO4.txt | 189 | None |
| GEO6(1).txt | 202 | Q41 |
| GEO7(3).txt | 197 | Q47, Q50, Q51, Q55, Q59, Q61 |
| Total unique source entries | 853 | |

The Geography subject includes 853 uploaded questions plus 12 questions in the original 2025 GS paper, giving 865 entries. Uploaded exam collections contain 222 UPSC CSE, 383 State PSC and 248 CDS/CAPF questions, covering supplied exam years from 1990 to 2025. All entries have supplied exam labels. GEO4 Q107 retains UKPSC 2005 and RPSC RAS/RTS 1997 as distinct occurrences; GEO6 Q105 retains both UPPCS Mains and Prelims 2005. UP RO/ARO and Uttarakhand Lower Subordinate labels are classified under State PSC. Each question appears once within a collection, with the matching occurrence's state/year/stage used for filtering and attempt metadata.

All supplied questions, options, marked answers and explanations were compared with the six source files. English/Hindi text, explanation paragraphs and the eight five-choice questions are retained. Source numbers and their gaps remain unchanged; missing numbers and an unsupplied GEO5 part are not filled with invented questions. File digests and counts are recorded in [GEOGRAPHY-SOURCES.json](GEOGRAPHY-SOURCES.json).

Uploaded Polity and Geography questions show **Provided answer** and **Explanation from supplied material**. These answers have not been independently verified against official answer keys. Practice marking is +1 right, 0 wrong/blank; it does not claim a State PSC marking scheme. Source question numbers are shown as Part/Q numbers, not invented official booklet numbers. Orphan citation markers in supplied prose are preserved as text without fabricated links.

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

Browse with combined exam collection, state, exam, year, stage, paper, subject, topic, subtopic, difficulty, status and text filters. Subject buttons include Geography and Polity; switching exams preserves the selected subject, and switching subjects clears the previous paper/topic/search. Practice a filtered set, shuffle it, or select one question. Saved sessions support up to 5,000 questions, including the full expanded bank. Full papers contain only the complete original 2025 papers in their original order: 100 GS or 80 CSAT questions. Uploaded subject collections are not represented as complete papers. Test mode hides answers, explanations and key links until final submission. A 2-hour deadline is optional for full-paper tests and continues while the page is hidden or the active timer is paused.

Individual-question practice starts at that question and continues in original order within its paper and subject/topic/difficulty filters. The search and latest-result filters locate the starting question rather than reducing this continuous session to one item. Next question is available beside feedback and in the sticky footer; the optional automatic-advance preference is saved in the workspace. Practice submission locks the choice and its active time; metadata remains editable. Going back does not change the result. Skipping records time with a blank answer and zero marks. Test choices remain editable drafts until final submission. The question palette shows answered, visited, unseen and review states. A current session must be resumed and finished before another starts, so draft answers are not silently replaced.

The per-question active timer uses a monotonic clock, pauses on hidden tabs, flushes before navigation/exit and checkpoints every ten seconds. Hidden/closed time is excluded from active time. Reload restores answers, confidence, notes, flags, position and recorded seconds. A timed session resumed after its deadline is finalized before allowing edits. Browser shutdown can lose at most the interval since the last checkpoint if lifecycle events never fire.

## Personal data and reports

Saved attempt records retain stable question ID, year, stage, paper, original number/booklet, source, session and mode, submission timestamp, choice, key snapshot, outcome, active seconds, confidence, mistake category, notes, difficulty and revision flag. Repeat attempts append new records. Post-submission review edits preserve scored fields and times. Failed storage writes do not advance the session or reveal feedback; quota errors remain visible for retry.

Reports show attempted/right/wrong/unattempted totals, raw marks, penalty, final score, accuracy, active time and subject/topic/difficulty breakdowns, plus per-question review. Completed reports freeze the key used for scoring. Revision includes latest mistakes, skips, bookmarks, review flags, repeat mistakes and weak topics (latest-attempt accuracy below 60%). CSAT reports for complete papers show the 66/200 practice benchmark. No rank or percentile is fabricated without cohort data.

Guest progress is browser-local. Configured accounts use the existing account-isolated repository and RLS-protected JSON workspace; the Account page shows save and sync status. This content import does not change account configuration or database permissions. See [ACCOUNTS.md](ACCOUNTS.md). No service-role key belongs in a public build.

JSON backups include sessions, completed reports, bookmarks, review flags, existing drafts and all historical records. Attempt CSV exports retain question parameters. Active public bank content is not copied into private workspace payloads, apart from the saved question text and source already required for history.

## Maintaining the bank

The original complete papers remain in `src/data/pyq-bank.json`. Preserve those IDs and validate official answers against the same booklet's key. Check every number, option, matching cell, continuation, formula and passage against the original PDF; keep incomplete reasoning explicitly flagged. Old image assets are retained for cached clients but are not used by this page.

Uploaded Polity lives in `src/data/polity-bank.json`; regenerate it with `node scripts/import-polity.mjs <source-directory>`, using the nine exact source filenames. Uploaded Geography lives in `src/data/geography-bank.json`; regenerate it with `node scripts/import-geography.mjs <source-directory>`, using the six exact filenames above. The lazy PYQ page combines all three banks without changing previous IDs. IDs are `polity-part-<part>-q-<number>` or `geography-part-<part>-q-<number>`, retaining the source file, question number and SHA-256 digest. Geography generation validates all expected counts and numbering gaps. Both parsers reject invalid numbering, missing explanations, ambiguous answers, unsupported option boundaries and unrecognized exam labels. Preserve supplied answer status until an independent verification establishes the corresponding official key. Tests cover source counts, collection/year separation, fifth-choice grading, Mains MCQs, scoring snapshots, large sessions, saved metadata and export compatibility.
