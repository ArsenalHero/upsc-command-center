# Book reading and revision tracking

Open **Workspace → Books**. Add your own book, or select **Add to shelf** on a suggested book. Suggestions fill the title, author/publisher and subject. Enter the total chapters from your edition; chapter totals are not assumed from a different edition.

## Chapter entries

- Numbers: `1,2,3`.
- Ranges: `1-4`.
- Mixed entries: `1-4,7,9-12`.
- Whitespace and pasted en/em dashes are accepted. Duplicate and overlapping chapters are counted once.
- Invalid syntax, reversed ranges, fractions, zero and chapter numbers above the book's total are rejected before saving.

When adding a book, **Completed chapters** and **Already revised how many times?** can record previous progress. The revision count applies to each completed chapter in that entry. The selected progress date applies to both records. Leave chapters blank for a new book.

Use **Log reading** or **Log revision** for new progress. Entries keep the date, selected chapters, activity, revision times and optional notes. A revision can only be recorded for chapters already read by that date. **Use all chapters read by this date** fills a revision entry with eligible chapters. For a new review, keep times revised at 1; larger numbers can represent earlier reviews. They are added to previous records. Use **Edit** in Progress history to correct an existing count instead of adding it again.

## Progress calculations

- Reading completion = unique chapters read / total chapters. Re-reading does not inflate this percentage.
- A chapter's revision count is the sum of the revision times in entries that include it.
- Chapter reviews = sum of all chapter revision counts. Reviewing 4 chapters twice produces 8 chapter reviews.
- Full book revisions = the lowest revision count across **all** chapters, including unread chapters with zero reviews. A book only gets one full revision when every chapter has at least one review.
- Revision goal completion = sum of each chapter's revision count capped at its target / (total chapters × target). Extra revisions of one chapter do not satisfy another chapter's goal.
- A revision target of zero removes the goal while preserving revision history and counts.
- Overall percentages use chapter totals, not an average of book percentages. Subject filtering updates the shelf, totals, history and suggestions together.

Progress rings, revision bars and expandable chapter maps show these counts. Dates after today are rejected. Entries are validated together: reducing a chapter total below an already recorded chapter or removing reading history needed by revisions is rejected. Edit related revisions first, or delete the complete book with its history through the confirmation dialog.

## Persistence and exports

`AppData.books` is optional, so existing schema-version-1 workspaces and backups remain valid. Saves use the existing atomic workspace repository: guest data is kept on this device; signed-in data follows the existing private account cloud sync. No new Supabase schema, permissions or authentication changes are required.

JSON backup/restore preserves plans and full reading/revision history. The Books CSV contains book summaries followed by dated chapter entries; cells escape CSV quotes and neutralize spreadsheet formula prefixes. Failed storage saves keep the dialog and existing data for retry.

## Suggested reading sources

These are the app's suggested foundations and subject references. They are not presented as an official UPSC book list. Titles and links were checked against NCERT or publisher sources on **2026-10-04**. Suggestions are optional and do not create reading progress until the user saves a book.

| Subject | Suggested book | Source |
|---|---|---|
| Polity | Indian Constitution at Work, Class XI | [NCERT](https://ncert.nic.in/textbook.php?keps2=0-10) |
| Geography | Fundamentals of Physical Geography, Class XI | [NCERT](https://ncert.nic.in/textbook.php?kegy2=0-14) |
| Economy | Indian Economic Development, Class XI | [NCERT](https://ncert.nic.in/textbook.php?keec1=0-8) |
| Polity | Indian Polity, M. Laxmikanth | [McGraw Hill](https://www.mheducation.co.in/courseware-on-indian-polity-9789364447676-india) |
| History | A Brief History of Modern India | [Spectrum Books](https://spectrumbooks.in/books/english/a-brief-history-of-modern-india-2025) |
| Geography | Certificate Physical and Human Geography, Goh Cheng Leong | [Oxford University Press](https://india.oup.com/product/certificate-physical-and-human-geography-9789354975660/) |
| Economy | Indian Economy, Ramesh Singh | [McGraw Hill](https://www.mheducation.co.in/courseware-on-indian-economy-9789364446570-india) |
| Environment | Environment | [Shankar IAS Academy](https://www.shankariasacademy.com/upsc-environment-book/) |
| Art and Culture | Indian Art and Culture, Nitin Singhania | [McGraw Hill](https://edge.mheducation.co.in/course/ArtandCulture-UPSC-NitinSinghania-172) |

The three NCERT suggestions link to free official textbook PDFs. Reference links identify publishers; the tracker does not reproduce paid books, promise free copies of them, or assume their chapter totals. Pick the material that fits your syllabus and edition.
