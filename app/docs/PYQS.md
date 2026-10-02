# Question bank and practice history

The built-in bank contains 220 English UPSC CSE questions: the complete 2024 and 2025 Prelims GS-I Set A papers (100 questions each), and the complete 2025 Mains GS-II paper (20 questions). Other years and papers are not included yet. The bank links to the UPSC archive for additional papers.

## Sources and marking

- 2025 Prelims: [UPSC original paper](https://www.upsc.gov.in/sites/default/files/QP-CSP-25-GENERAL-STUDIES-PAPER-I-26052025.pdf).
- 2025 Mains GS-II: [UPSC original paper](https://www.upsc.gov.in/sites/default/files/GENERAL-STUDIES-PAPER-II-QP-CSM-25-010925.pdf).
- 2024 Prelims: [mirror of the original UPSC paper](https://shankariasacademy.com/pdf/Upsc-Qus-Papers/UPSC-Prelims-2024-PAPER-I.pdf).
- 2024 marking: [mirror of the UPSC Series A answer key](https://shankariasacademy.com/pdf/Upsc-Ans-Key/2024-Prelims-Paper1-AnswerKey.pdf). Q20, Q52 and Q57 were dropped and are excluded from accuracy.
- [Official question-paper catalogue](https://www.upsc.gov.in/examinations/previous-question-papers).

The 2025 Prelims key is not connected to this version. Choices and times are saved regardless; visitors can leave the result unmarked or explicitly self-assess it. This is not a statement about whether UPSC has released a key. Mains answers have optional self-assessed marks rather than automatic right/wrong grading. Self-marked MCQ results are identified and included in accuracy; skipped, dropped, unmarked and written answers are excluded from its denominator.

Prelims practice displays crops from the actual English paper pages, including tables and questions that continue across columns. OCR text is used for searching, previews and the optional transcript; it can contain transcription errors. The original images are authoritative. Mains text was transcribed and checked against the original paper. Subject and topic tags are study categories assigned for this bank, not UPSC's official classification.

## Data and timing

Each submitted question appends a separate `PYQRecord.attempt` to the user's existing private workspace. It includes the question ID, year, paper, original number/booklet, source, session, timestamp, selected option, key, marking basis, outcome, active seconds, confidence, difficulty, mistake category, notes, revision flag, and any written answer/self-assessed marks. Reattempting preserves earlier attempts. Bank status and revision filters use the latest attempt; history and accuracy statistics include all attempts.

The timer uses a monotonic clock, starts automatically on new questions, pauses when the tab is hidden or practice is exited, and restores paused after a reload. Draft inputs are saved immediately and elapsed time is checkpointed every ten seconds. Abrupt browser/process termination can lose up to the last checkpoint's elapsed seconds. Submission atomically saves the attempt and advances the draft; double submission cannot create another record with the same ID. A skipped question saves its time but no answer.

Guest practice remains in that browser's storage. Configured accounts use the same account-isolated repository as other study data; see [ACCOUNTS.md](ACCOUNTS.md) for backend activation. The public question bank and paper images are not copied into private workspace payloads. JSON backup includes full history and the current draft; PYQ CSV exports include separate columns for attempt parameters. Existing version-1 backups and manual PYQ batch logs remain compatible.

Question time contributes once to dashboard hours and daily trends. Graded Prelims attempts contribute to correct/wrong totals; unmarked attempts count as attempted but do not reduce accuracy. Mains written answers contribute to answer totals and optional self-assessed score averages. No duplicate MCQ or answer-writing records are inserted.

## Maintaining the bank

Edit `src/data/pyq-bank.json` and add original English page images under `public/pyq/`. IDs must be stable, unique and include year, paper and booklet where relevant. Each image slice specifies its URL, pixel crop and original image dimensions. `sourceUrl` must identify the original paper or clearly labelled mirror. Verify every question number and any cross-column continuation against the original PDF. Only set `keyStatus: "official"` after checking that the key matches that exact paper and booklet. A missing key is `pending`; a cancelled question is `dropped` with a null answer.

Run `npm run test`, `npm run test:ui`, and `npm run build` from the repository root. The bank tests check complete numbering, dropped questions, image bounds and paths, grading rules, timer accounting, repeat history, backup/export fields and dashboard totals. The UI test exercises real React flows for filter selection, submission, hidden-tab timing, review notes, resumed drafts, repeated questions and Mains writing. These simulated checks do not verify a live Supabase project's email delivery or authentication setup.
