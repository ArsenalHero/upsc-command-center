# Requirement map

| Requested capability | Implementation |
|---|---|
| React, TypeScript, Vite, Tailwind, Recharts, Lucide | `package.json`, `vite.config.ts`, `src/main.tsx` |
| Workspace and preparation navigation with Pages-safe refresh | `src/App.tsx`, HashRouter, `src/components/Layout.tsx` |
| Full UPSC GS and CSAT topic master | `src/data/defaults.ts` |
| Book reading by chapter lists/ranges, per-chapter revisions, full-book cycles, progress rings/maps and history | `src/pages/Books.tsx`, `src/utils/books.ts`, `AppData.books`, `docs/BOOKS.md` |
| NCERT and publisher-backed suggested UPSC reading list with subject-prefilled book forms | `src/data/bookSuggestions.ts` |
| Local persistence and future storage adapter | `src/services/repository.ts`, `src/hooks/useData.tsx` |
| Full study, test, MCQ, answer, essay, ethics, CA, PYQ forms | `src/components/RecordForm.tsx` |
| Optional and unlimited custom hierarchies | `src/pages/Syllabus.tsx`, Optional view in `src/pages/Practice.tsx` |
| Custom resources, activities, courses, modules, series, categories | `src/pages/Resources.tsx`, catalog collections |
| Dashboard KPIs and progress indicators | `src/pages/Dashboard.tsx`, `src/components/ui.tsx` |
| Trend, bar, donut, radar, heatmap, scatter, treemap | `src/charts/index.tsx` |
| Daily timeline and weekly stacked bars | `src/pages/DailyStudy.tsx`, `StudyDetails`, `WeeklyStudyChart` |
| Calendar, backlog, lifecycle, completion | `src/pages/Revision.tsx`, `TopicDetail` |
| Optional spaced repetition with a 1–7–14–30–90 preset, custom days and automatic next reviews | `src/pages/Revision.tsx`, `src/utils/revision.ts`, `src/hooks/useData.tsx` |
| Personal workspace State PSC exam selection, names, dates and live countdowns including seconds | `WorkspaceExamDialog`, `ExamSettingsFields`, `ExamCountdowns`, `src/utils/examSettings.ts` |
| MCQ funnel, errors, repeated topics | MCQAnalysis view in `src/pages/Practice.tsx` |
| Knowledge health, strength matrix, weak-topic list, priority quadrants | `src/pages/WeakAreas.tsx`, `subjectStats`, `topicStats` |
| Configurable targets, allocation, importance, thresholds and weights | `src/pages/Settings.tsx`, `src/pages/Goals.tsx` |
| Evidence-backed insights and next study priorities | `src/utils/analytics.ts`, `src/components/Insights.tsx` |
| CSAT neglect warning without qualification prediction | `insights`, CSAT view |
| Daily/weekly/monthly/quarterly/yearly reports | `src/pages/Reports.tsx` |
| Three-month comparisons and sustained trend analysis | Rolling quarterly report, historical topic status snapshots |
| Onboarding and explicit fictional demo | `SetupWizard`, `src/data/demo.ts` |
| Universal search and reusable analytics filters | `GlobalSearch`, `src/components/Filters.tsx` |
| JSON backup and validated restore, all-collection CSV | `ExportImportPanel`, `src/services/export.ts`, `validation.ts` |
| Desktop/sidebar, mobile/bottom-nav, dark theme, accessible forms | `Layout`, native dialog, `src/styles.css` |
| Installable/offline app shell | `public/manifest.webmanifest`, `scripts/generate-sw.mjs` |
| GitHub Pages deployment | `.github/workflows/deploy.yml`, relative Vite base, README |
| Architecture, preparation, analytics, ER diagrams and screenshot sections | `README.md` |
| Source-level and rendered functional verification | `tests/analytics.test.ts`, `tests/ui-check.mjs`, `docs/QA.md` |

Chart data, status labels, recommendations, and comparative metrics come from saved records and configured thresholds. Independent charts may have deliberately different scopes: dashboard period filters change the trend/practice views, while Today/This Week/This Month metrics retain their labeled periods and the activity heatmap shows six months.
