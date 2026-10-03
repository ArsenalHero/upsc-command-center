# UPSC Preparation Command Center

A responsive UPSC CSE preparation web app with study tracking, analytics, sign-up/login pages, and private account storage through Supabase. The frontend runs on GitHub Pages. Guest mode works without a backend. Real accounts require the setup in [docs/ACCOUNTS.md](docs/ACCOUNTS.md); the current public configuration is empty and account forms remain disabled until it is activated.

## Get started

Requirements: **Node.js 22 or newer** and npm.

```bash
git clone https://github.com/ArsenalHero/upsc-command-center.git
cd upsc-command-center
npm ci
npm run dev
```

Open the local address printed by Vite (port 4173 by default). First launch shows the login/signup page; choose Continue as guest to use device storage. Opening a new workspace shows a skippable six-step setup wizard. Enter your target year, Optional, daily study target, planned exam dates, weekly practice goals, and allocation percentages. Exam dates start blank; enter dates from your official calendar.

Choose **Explore with fictional demo data** during setup or **Settings → Load Demo Data** to explore a realistic six-month preparation history. Demo mode is clearly labeled. Loading demo data replaces the current workspace after confirmation if records already exist. Export a backup first. Clear Demo Data removes fictional records, clears unchanged fictional exam dates, and resets untouched seeded syllabus progress; personal entries, edited topics, and needed resource/series references remain.

## Main features

- 2025-only Prelims PYQ bank: GS-I 100 + CSAT 80, text/tables/passages, official keys, practice and timed tests, saved answers/times/notes, reports and revision lists. See [PYQ sources and coverage](docs/PYQS.md).

- Subject lecture targets, daily completion logs, course/deadline fields, completion rings, daily bars and an activity calendar; safe edits, JSON backups and lecture CSV export. See [lecture tracking](docs/LECTURES.md).
- Continuous PYQ practice with a Next question button after grading and a saved automatic-advance preference.
- Sign-up, login, signup confirmation/resend, password recovery, and an Account page for cloud sync, backup, importing guest data, and signout.
- 20 preparation routes plus Account: Dashboard, Daily Study, Lectures, Syllabus, Prelims, Mains, Optional, CSAT, Current Affairs, Answer Writing, Essay, MCQ Analysis, PYQs, Tests, Revision, Weak Areas, Goals, Reports, Resources, and Settings.
- Full study form with start/end times, stage/paper, subject/topic/subtopic, resource/activity, planned and actual minutes, questions, marks, PYQs, answers, revision, focus, energy, difficulty, distraction, notes, gaps, and next revision date.
- Dedicated MCQ, test, answer, essay, ethics case study, current affairs, PYQ, revision, resource, goal, and catalog forms.
- Expandable syllabus hierarchy with direct status changes, topic details, completion history, leaf-topic treemap, and paper progress.
- Editable Optional with Paper I → Unit → Topic → Subtopic and Paper II. Add unlimited custom subjects and hierarchy levels.
- Custom study activities, courses, coaching modules, test series, categories, resources, and goals. New entries appear in relevant forms, filters, and analytics.
- Hours trend, subject bars, stage donut, target versus actual study balance, subject radar, contribution heatmap, daily timeline, weekly stacked bars, accuracy and test trends, error charts, answer scatter plot, priority quadrants, knowledge-health cards, and indicator matrices.
- Revision calendar with due-today, upcoming, completed, and overdue states. Select dates, complete or reschedule revisions, and inspect topic learning stages.
- Daily, weekly, monthly, rolling quarterly, and yearly reports; matched elapsed-period comparisons; separate units for hours, counts, and percentages; downloadable text reports.
- Configurable, transparent productivity scoring and rule-based insights with observation, evidence, rationale, action, and target.
- Universal search for subjects, topics, notes, tests, PYQs, resources, current affairs, essays, answers, and practice records.
- Light/dark/system theme, mobile bottom navigation and full navigation drawer, keyboard-operable forms, accessible dialog focus, labeled controls, explanations, and empty states.
- JSON backup/restore with validation and confirmation, CSV export for every data collection, and storage failure/recovery messages.
- Installable PWA with offline access after a successful initial online load.

## Production build

```bash
npm run typecheck
npm run test
npm run test:ui
npm run build
npm run preview
```

The app output is `app/dist/`, also copied to the repository root by the root build command. The build also generates a versioned service worker that precaches the app shell, icons, stylesheet, and all lazy-loaded route/chart chunks. Guest mode needs no backend. Authenticated accounts require a configured Supabase Auth/database project.

Do not open `index.html` by double-clicking it. ES modules and service workers require an HTTP server. Use `npm run dev`, `npm run preview`, or a static host.

## GitHub Pages deployment

The linked repository is [ArsenalHero/upsc-command-center](https://github.com/ArsenalHero/upsc-command-center), and its website is [UPSC Command Center](https://arsenalhero.github.io/upsc-command-center/). The complete editable project lives in `app/`; the compiled website is at the repository root.

GitHub Pages uses **Deploy from a branch → main → / (root)**. Keep that existing setting. At the repository root, `npm ci` installs the app workspace and `npm run build` builds `app/dist/`, then copies it to the root along with `.nojekyll`. Commit source and generated files together. Main-branch changes automatically trigger the Pages build and deployment. All built assets must accompany `index.html`.

The root's `index.html` is compiled output; edit `app/index.html` and `app/src/` instead. The generated asset paths are relative and the app uses hash routes, so project-page refreshes keep working. Old hashed assets can remain for clients that already loaded the previous version.

For account activation, follow [docs/ACCOUNTS.md](docs/ACCOUNTS.md). Frontend deployment alone does not configure an authentication provider or a database.

## Data storage and backup

Guest data is stored under `upsc-command-center:v1` in LocalStorage and persists through refresh. Authenticated accounts use the private Supabase database plus a separate per-account pending cache. Account data loads only after an authenticated server read. Signing out clears the account cache, and stale device changes cannot silently overwrite newer cloud records. See [docs/ACCOUNTS.md](docs/ACCOUNTS.md) for setup, email delivery, security, and sync behavior. The optional WebMCP capability is feature-detected; ordinary app use does not require it.

Storage is specific to the browser profile and origin. A GitHub Pages app, a local preview, a new domain, and a different browser have different workspaces. JSON export/import transfers data between them. Browser clearing or private browsing can remove data. Use **Settings → Export Data · JSON** regularly.

The JSON backup includes all settings, subjects, topics and their histories, sessions, MCQs, tests, answers, essays, ethics records, current affairs, PYQs, revisions, resources, catalog items, and goals. Imports validate the version, required types, dates, counts, scoring limits, thresholds, allocation total, references, duplicate IDs, and hierarchy cycles before replacing data. A corrupted saved workspace is preserved rather than silently overwritten. The Settings recovery control can export its raw bytes.

CSV exports are available from each record table and Settings. They include IDs as well as readable subject/topic labels, escape commas and quotation marks, and neutralize leading spreadsheet formulas. CSV exports are for analysis; **only JSON backups are restorable**.

LocalStorage supports a useful personal dataset but has browser-dependent size limits, commonly a few megabytes. Storage failure is surfaced before a change is applied. For larger multi-user datasets, replace `DataRepository` with an IndexedDB or cloud adapter.

## How the analytics work

- **Hours:** actual session minutes / 60; planning is tracked separately. Distraction minutes are reported separately and are not silently subtracted.
- **MCQ accuracy:** total correct / total attempted, weighted by question counts. Practice sets linked to study sessions are counted once. Correct + incorrect must equal attempted in dedicated MCQ records.
- **Study-form questions:** a scored linked MCQ record is created automatically when questions are fully marked. Its counts feed the same analytics. Editing that study session replaces its generated MCQ record; keep detailed error edits in the MCQ view after the study entry is finalized.
- **Test performance:** score / each test's maximum marks. Accuracy is correct / attempted. Negative test scores are allowed to represent negative marking.
- **Answers:** detailed answer records plus answers counted in study sessions without a linked detailed answer. Do not separately count the same work twice. Average answer score only uses detailed scored records.
- **PYQs:** counts logged in sessions plus correct/incorrect counts in dedicated PYQ batches. Avoid separately logging the same batch twice. Frequency charts count PYQ entries in your dataset, not all UPSC exam questions.
- **Syllabus:** leaf topics count equally; completed/mastered/revision-due = 100%, in progress = 50%, not started = 0%. Parents are structure, not extra weighted topics. Status histories let reports measure historical coverage rather than reuse today's completion for every month. Parent-topic detail queries include descendant topic activity.
- **Revision completion:** completed scheduled revisions / revisions due in the period. **On-time health** additionally requires completion on or before the due date. Overdue backlog is incomplete past-due work. Revision activity counts include completed schedules and study entries marked Revision Done; avoid double-logging the same revision.
- **Productivity:** available component scores are capped at 100%, multiplied by configured weights, and divided by the sum of available weights. Hours and practice targets are prorated by calendar days. Focus = mean recorded focus × 10. Unmeasured accuracy, focus, and scheduled revision indicators are excluded. The dashboard lists every component and weight used.
- **Strength/weakness:** uses coverage, scheduled revision completion, sufficiently sampled MCQ accuracy, test score, and answer score. Fewer than two measured indicators = Needs data. At least two below the weakness threshold = Weak. At least 70% of measured indicators above the strength threshold = Strong. Study hours never directly determine strength or weakness.
- **Neglect:** activity gaps and target-allocation gaps are separate from knowledge weaknesses. CSAT warnings count study days without CSAT study or MCQ practice, not calendar days.
- **Radar:** coverage, revision, accuracy, PYQs as a share of the configured monthly PYQ target, mean test score, and mean answer score. Unmeasured dimensions are labeled and appear at zero in this visual; the matrix uses `—` for missing data.
- **Study balance:** each session is assigned one category. Custom allocation names can match an activity or subject. Otherwise Optional/CSAT, Current Affairs, Revision, Answer Writing, Tests, PYQs, and GS are used in that order. Targets must sum to 100%.
- **Comparisons:** reports can compare equal elapsed days. Percentage changes are reported in percentage points; counts and hours show numerical and relative changes. The current month is labeled partial. Quarterly reports examine a rolling three-month window; sustained trends are not inferred from a partial month.
- **Insights:** deterministic rules, not a remote language model. Each insight contains actual evidence, why it matters, an action, and a measurable target. Priorities consider overdue revision, low practice accuracy, upcoming tests, high-priority activity gaps, Optional allocation, and CSAT neglect. The app does not predict exam selection or qualification.

Reports and filtered charts use actual records. There are no fabricated user totals outside explicitly loaded fictional demo data. Empty periods display an actionable empty state. Exam dates and Optional syllabus content are user configurable and are not represented as official UPSC updates.

## Architecture

```mermaid
flowchart TD
    A[Student] --> B[Daily Study Entry]
    B --> C[Study Database]
    C --> D[Analytics Engine]
    D --> E[Daily Dashboard]
    D --> F[Weekly Dashboard]
    D --> G[Monthly Dashboard]
    D --> H[Quarterly Dashboard]
    C --> I[MCQ Analysis]
    C --> J[Revision Tracker]
    C --> K[Syllabus Tracker]
    C --> L[Test Analysis]
    C --> M[Answer Writing]
    I --> N[Weak Area Detection]
    J --> N
    K --> N
    L --> N
    M --> N
    N --> O[Insight Engine]
    O --> P[Recommended Priorities]
```

### Preparation flow

```mermaid
flowchart TD
    A[Learn Topic] --> B[Make Notes]
    B --> C[Revision 1]
    C --> D[Revision 2]
    D --> E[PYQ Practice]
    E --> F[MCQ or Answer Writing]
    F --> G[Test]
    G --> H[Error Analysis]
    H --> I[Targeted Revision]
    I --> G
```

### Analytics flow

```mermaid
flowchart TD
    A[Daily Data] --> B[Study Hours]
    A --> C[MCQ Data]
    A --> D[Revision Data]
    A --> E[Test Data]
    A --> F[Answer Writing]
    B --> G[Analytics Engine]
    C --> G
    D --> G
    E --> G
    F --> G
    G --> H[Strength Detection]
    G --> I[Weakness Detection]
    G --> J[Trend Detection]
    H --> K[Recommendations]
    I --> K
    J --> K
```

### Data relationships

```mermaid
erDiagram
    USER ||--o{ STUDY_SESSION : records
    SUBJECT ||--o{ TOPIC : contains
    TOPIC ||--o{ TOPIC : has_subtopics
    TOPIC ||--o{ STUDY_SESSION : studied_in
    TOPIC ||--o{ REVISION : has
    TOPIC ||--o{ MCQ_SESSION : tested_in
    TOPIC ||--o{ PYQ : contains
    SUBJECT ||--o{ TEST : assessed_by
    SUBJECT ||--o{ ANSWER : practised_in
    SUBJECT ||--o{ RESOURCE : uses
    STUDY_SESSION ||--o{ MCQ_SESSION : may_generate
    STUDY_SESSION ||--o{ TEST : may_generate
```

`USER` represents either a guest browser workspace or an authenticated Supabase user with a private versioned workspace row. Insights are derived, not stored as stale records. Subtopics use a self-referencing topic tree.

## Folder structure

```text
public/                       Manifest, icons, and public auth configuration
supabase/migrations/          Private workspace table and authorized save function
scripts/generate-sw.mjs       Production offline precache generation
src/
  components/                 Layout, forms, dialogs, tables, charts' wrappers
  pages/                      Dashboard and all tracking/analytics routes
  charts/                     Responsive reusable Recharts components
  hooks/                      Persistent app context and mutation actions
  utils/                      Dates, aggregation, coverage, goals, insights
  data/                       Full subject master and fictional demo generator
  types/                      Versioned domain model
  services/                   Repository, validation, backup/CSV, optional WebMCP
  App.tsx                     Lazy HashRouter routes
  main.tsx                    Entry point and production PWA registration
  styles.css                  Light/dark tokens and responsive layout
 tests/                       Analytics/storage tests and rendered UI smoke test
 docs/                        QA and requirement notes
```

## Dashboard Preview

_Screenshot/GIF placeholder: dashboard metrics, hours trend, contribution heatmap, and next-focus priorities._

## Study Analytics

_Screenshot/GIF placeholder: hours, allocation, accuracy, radar, test trend, and answer-quality scatter plot._

## Syllabus Tracker

_Screenshot/GIF placeholder: expandable topic hierarchy, direct status controls, treemap, and topic details._

## Revision Dashboard

_Screenshot/GIF placeholder: calendar, due/overdue agenda, completion controls, and learning lifecycle._

## MCQ Analysis

_Screenshot/GIF placeholder: question funnel, error categories, subject errors, and repeated topics._

## Monthly Report

_Screenshot/GIF placeholder: matched period comparisons and separate metric charts._

## Mobile View

_Screenshot/GIF placeholder: stacked dashboard cards, responsive charts, quick add, bottom navigation, and full navigation drawer._

## Verification

`npm run typecheck` checks the full TypeScript app. `npm run test` exercises weighted accuracy, double-count prevention, filters, descendants, revision timeliness, coverage history, multi-indicator strengths, productivity, streak, custom categories, neglect warnings, invalid backups, CSV safety, and refresh persistence.

`npm run test:ui` renders the React app in JSDOM, checks auth page states, guest setup, all preparation routes and report periods, form persistence, and refresh restoration. A second test runs the actual Supabase Auth SDK against a simulated API, checking signup, confirmation/resend, recovery, invalid login, cloud saves, signout cleanup, and account isolation. `npm test` also executes the database migration and privacy/conflict checks in local Postgres. This is a rendered functional smoke test, **not a substitute for browser visual or responsive QA**.

The development environment's browser-preview infrastructure was unavailable, so desktop/mobile screenshots and real browser interaction/installation/offline tests were not verified there. Before public deployment, open the app in a real browser at 1440px, 1024px, 768px, and 375px; test keyboard-only navigation, import/export downloads, reload on a nested hash route, and airplane-mode reload after service-worker installation. See `docs/QA.md`.

## Future roadmap

The `DataRepository` interface separates persistence from the UI. LocalStorageRepository serves guest mode; CloudWorkspaceRepository serves authenticated accounts, with queued writes, pending backups, account isolation, and conflict handling.

Possible future extensions: externally generated AI analysis, OCR notes, reminders, mobile notifications, mentor dashboards, study groups, and collaborative planning.

## License

`LICENSE` is an explicit placeholder. Choose and replace it with an appropriate license before open-source distribution. Dependencies retain their respective licenses.

### Deployment references

The publishing source follows [GitHub's branch publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [Vite's static deployment guidance](https://vite.dev/guide/static-deploy). This app uses relative build URLs with hash-based routing so repository subdirectories remain portable.
