# Website performance update

The dashboard renders study trends only when expanded. Its filters stay saved while the section is closed. PYQs is a separate lazy route, so Prelims, Mains and other general practice views no longer import the question and explanation library. Progress summaries group logs once instead of scanning the full history for every book or lecture target; search, sorting and form edits reuse cached summaries.

## Production build measurements

| Measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Dashboard static JavaScript | 986.1 KB | 466.6 KB | 52.7% |
| Offline startup assets | 42.9 MB | 3.7 MB | 91.5% |
| Precache requests | 122 | 60 | 50.8% |

These are file/dependency measurements from production builds, not Lighthouse scores or measured download times. Browser compression, device speed and connection quality affect observed loading time. The JavaScript comparison follows the entry point and default dashboard's static imports; account setup and other requested views can load additional modules.

## Large-history calculation check

A synthetic workspace with 400 plans and 40,000 log entries produced identical summaries before and after the change, including historical dates and subject filters. Median durations over five runs in this environment:

| Calculation | Before | After |
| --- | ---: | ---: |
| Books | 94.5 ms | 6.7 ms |
| Lectures | 219.5 ms | 43.3 ms |

## Offline behavior

Core UI screens, shared chart assets, icons and all six landscape wallpapers still precache. The large question/explanation chunks and paper figures cache when opened in PYQs; first access requires a connection. Unchanged question chunks from both the earlier full cache and the new runtime cache survive app updates. If storage is full during migration, the old immutable asset stays readable without another download. Immutable assets use the cache first, while navigation HTML refreshes online and falls back to the saved shell offline. Cache write failures do not interrupt successful content requests. Authentication callbacks, configuration and API traffic are excluded from runtime caching. Saved study records are stored separately and are unchanged.

Production builds now check budgets of 600 KB for the default dashboard's static JavaScript and 6 MB for the core offline package. The checks also reject question-bank imports from general practice/core pages. `npm run test:performance` verifies the worker, log-scan scaling and the built package.

Validation: 76 unit tests; worker lifecycle, offline retrieval, update cleanup and quota handling; default dashboard and retained filter state; existing Books/Lectures, appearance and Golden Gate workflows; the production TypeScript/Vite build. Browser geometry, Lighthouse and screenshot QA are unavailable in this environment.
