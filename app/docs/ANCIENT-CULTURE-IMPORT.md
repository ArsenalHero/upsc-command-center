# Ancient, medieval and cultural PYQ import

The 12 new attachments contain 1,255 question records: 567 History and 688 Art & Culture. Exact duplicate matching plus six reviewed spelling/formatting pairs merges 90 repeated records. This release adds 1,165 unique practice entries, taking the visible bank from 6,371 to 7,536 questions. All 7,882 source records remain addressable.

The new bank preserves each supplied English/Hindi question, explanation, answer, all four or five choices, original file and question number, exam occurrences, and SHA-256 file hash. There are 47 five-choice questions. Exam labels distinguish CSE, State PSC and CDS/CAPF; re-exam commas remain part of the exam label. Study subject/topic classifications are editorial groupings.

AM3.txt skips Q30; it contains 203 records ending at Q204. Cultural Heritage 1 labels its 18th entry Q118. Both source anomalies are documented in ANCIENT-CULTURE-SOURCES.json; neither a missing record nor a replacement header is invented. The source files are not modified.

## Explanation and answer review

The two UNESCO heritage chronology questions have reference-reviewed explanations and reasons for each actual option. The intangible heritage comparison is scoped to the 2024 question's four choices, avoiding an inaccurate claim that Garba remains India's latest inscription today.

Mir Bakhshi's revenue-duty question has no choice describing the documented military office. The Varna-protector question lacks evidence for the exact epithet, the tabla question turns an unsupported traditional attribution into a claim of documented invention, and the Hazara Rama construction attribution requires reconciliation with other published accounts. These four questions receive explicit issue notes and remain ungraded. Their original supplied keys and notes remain expandable.

**This import does not certify every supplied explanation.** Untraceable citation placeholders are retained in the raw bank but removed from the study view. Source notes remain labelled for independent verification. Where a separate distractor explanation is absent, the option panel says so rather than inventing one. EXPLANATION-AUDIT.json records the current review coverage and missing-option counts.

## Saved progress

Existing question IDs, source versions, bookmarks and saved grading snapshots are retained. The official 2025 papers and keys are unchanged. A disputed new attempt saves the selected option and active time without counting it as correct or incorrect. Review explanation opens a read-only preview without recording an attempt.

## Reproduce

```sh
node scripts/import-ancient-culture.mjs /path/to/new-attachments
node scripts/deduplicate-pyqs.mjs
node --import tsx scripts/audit-explanations.mjs
npm run typecheck
npm test
npm run test:ui
npm run build
```
