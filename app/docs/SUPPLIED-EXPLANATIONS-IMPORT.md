# English questions and supplied HTML explanations

The website imports all 8,039 records from `pyq-problems-and-explanations.html`. The **Supplied explanations** tab makes every record available by subject, exam, year and question search. It preserves the supplied explanation wording, tables, lists, headings, emphasis and page references.

4,868 source explanations match 4,757 existing canonical practice questions and their compatible legacy IDs. Matches require the same English question after punctuation and list-marker normalization, with identical option text in the same letter order. All unmatched or ambiguous records remain available in the complete explanation library. Matching practice questions display the supplied explanation before any earlier editorial notes.

The existing 7,536-question practice bank keeps its IDs, bookmarks, answer letters, official keys, marking, saved attempts and time records. Source records remain intact for provenance; every displayed practice question, option, explanation and duplicate source version uses English. The two Hindi passages inside the uploaded HTML explanations are removed from display while retaining the adjacent English text.

The separate **Review every option** panels are removed. Option-specific reasoning that is already part of the uploaded explanation remains exactly as supplied. Uploaded explanations are labelled as source material; they are not relabelled as independently reviewed. Existing disputed answer keys remain ungraded.

The importer reads the JSON data block without executing the uploaded HTML. It validates all static HTML fragments against the supported tags and attributes before storing them. The source and aggregate question, option and explanation hashes are recorded in `SUPPLIED-EXPLANATIONS-IMPORT.json`.

Regenerate with:

```sh
node --import tsx scripts/import-supplied-explanations.mjs /path/to/pyq-problems-and-explanations.html
```
