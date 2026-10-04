# History and Economy import

The 13 attached files contain 1,952 source questions: 1,497 History and 455 Economy. Ancient History has 251 questions; Modern History has 1,246. The bank adds 1,860 unique entries after merging 92 repetitions. There are now 6,371 visible practice questions and 6,627 preserved source entries.

Import metadata and SHA-256 hashes are in HISTORY-ECONOMY-SOURCES.json. The original bilingual explanations, marked answers, choices and source numbering remain in history-economy-bank.json. Unmarked answer bodies stay unmarked in the raw data. State PSC, UPSC CSE and CDS/CAPF labels remain separate; multiple exam occurrences remain searchable by the corresponding year. An unlabelled question retains an unknown exam/year.

## Explanation review

The upload contains untraceable citation placeholders and some drafting remarks. Placeholders are removed from the study view, while the raw data and expandable source versions preserve the supplied text. They are never converted into invented references.

explanation-reviews.json contains an editorial review layer. It supplies reasoning for every actual choice, named references, review date and any answer issue. Reference-backed editorial answers are labelled separately from an official exam key. Reviewed notes can be shared across duplicates only when all choice texts align; reordered choices are remapped. An original paper's official key is retained.

The review covers several high-risk errors, including RBI note-printing income, NFT tradability, Ptolemy II versus III, Thomsen's 1836 guide, Harappan arrowheads, GDP definitions, the mover of the Lahore Resolution, current-account versus trade deficit, and blue-chip return claims. Two source answers unmarked in their bodies have referenced editorial resolutions. Six ambiguous or defective questions remain ungraded for new attempts.

**This release does not certify every explanation as authentic or independently verified.** Most of the bank still has source notes awaiting independent review. Each option has a visible review panel: existing source context or code comparison is labelled accordingly, and a missing reason is explicitly identified rather than fabricated. An official answer key does not itself verify all explanatory claims. EXPLANATION-AUDIT.json records the remaining coverage gaps and reviewed entries.

## Progress compatibility

All raw IDs remain addressable. Deduplication retains each source copy and its original key/explanation. Saved key snapshots keep earlier marks and outcomes unchanged; new disputed attempts save their option and active time without inventing a wrong result. Bookmarks, revision flags, reports, exports and original full papers remain available. Sessions up to 10,000 questions support the expanded bank and remain validated on restore.

## Reproduce and validate

```sh
node scripts/import-history-economy.mjs /path/to/attached-files
node scripts/deduplicate-pyqs.mjs
node --import tsx scripts/audit-explanations.mjs
npm run typecheck
npm test
npm run test:ui
npm run build
```
