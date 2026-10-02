# Verification and acceptance checks

## Automated checks

- `npm run typecheck`: checks the complete app's TypeScript, JSX, imports, and route components.
- `npm run test`: exercises analytical invariants, validation, data persistence, date periods, and CSV escaping.
- `npm run test:ui`: bundles and renders the real app in JSDOM; exercises setup, empty state, demo mode, all 19 route headings, each report tab, the actual study form, and saved-state restoration.
- `npm run build`: compiles production assets, lazy route/chart chunks, and offline precache output.
- `npm ci`: installs the reproducible dependency lockfile used by GitHub Actions.

JSDOM uses simulated dimensions. It validates rendering and interaction logic, not browser layout, visual appearance, download dialogs, installation, service-worker lifecycle, or screen-reader output.

## Browser checks to run before public release

The build environment's supervised browser preview was unavailable. These checks remain for a real browser; they are not reported as passed.

1. **Desktop:** at 1440 × 1000 and 1024 × 768, open Dashboard, Reports, Revision, Syllabus, and Settings. Check card stacking, chart labels/tooltips, sidebar scroll, dialog overflow, and the top five priorities.
2. **Mobile:** at 375 × 812 and 320 × 700, verify no whole-page horizontal scrolling; bottom navigation and More drawer; Quick Add menu; table-to-card layout; touch-friendly forms; heatmap, calendar, and matrix cells; and a usable topic tree with long names.
3. **Tablet:** at 768 × 1024, verify charts resize and two-column content becomes one column when needed.
4. **Zoom/accessibility:** at 200% zoom, check text enlargement; Tab/Shift-Tab through navigation and forms; open help summaries; Escape closes dialogs; focus returns to the opener; labels and ARIA values are exposed; color is accompanied by text/values.
5. **Personal data:** skip setup, add a study session with a custom subject/topic/activity and a next revision date, reload, and verify that all fields persist and the revision appears. Record questions and verify analytics count them once.
6. **Backup:** export JSON, modify a record, import the original backup, review counts and confirm, then verify restoration. Reject invalid JSON and impossible question counts without losing current data. Export all relevant CSV collections and open them.
7. **Revision:** schedule an overdue, today, and future revision; select each calendar date; complete one; reschedule another; verify health versus completion. Confirm topic details show the learning stage.
8. **Reports:** visit Daily, Weekly, Monthly, Quarterly, and Yearly tabs. Change the period date, compare elapsed versus complete periods, and verify charts keep units separate. Current months must be marked partial.
9. **GitHub Pages:** load `/REPOSITORY/#/reports`, refresh, and confirm it resolves to the root `index.html`. Test on a root custom domain if used.
10. **PWA:** build, serve over localhost/HTTPS, load every route once, wait for service-worker activation, install where supported, go offline and reload a hash route, log a study session, then restart the app and verify local data remains. Test an app upgrade with an existing workspace.
11. **Themes:** toggle light and dark, save system mode, reload, and check chart axes, tooltips, cards, matrix text, and form controls have readable contrast.
12. **Optional/customization:** rename the Optional, add another custom Optional subject, add Paper I/II units with nested topics and subtopics, and check filters and charts. Subject priority settings should affect the priority quadrants.

## Known Version 1 limits

- Data is device/origin local and limited by the browser's LocalStorage quota. No cross-device synchronization.
- Insights are explainable rules. No AI network calls or selection predictions.
- Independent manual study counts and detailed answer/PYQ/revision records can duplicate the same activity if entered twice; log each piece of work once, or use the existing linked study/MCQ/test path.
- Optional unit/topic names in demo data are fictional examples, not a complete official Optional syllabus.
- Radar visuals show unmeasured dimensions at zero with a notice; exact data availability is represented with `—` in the matrix.
- Optional WebMCP registration is feature-detected. A supported real browser context was unavailable for end-to-end validation.
- GitHub deployment needs a repository chosen and created by its owner. The project is prepared, not deployed to an account.
