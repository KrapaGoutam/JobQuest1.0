# Feature and UI Upgrade 1.1

Feature Upgrade 1.1 establishes a reusable JobQuest design system and modernizes the existing vanilla JavaScript application without changing its Neon PostgreSQL, authentication, authorization, or deployment architecture.

## Design research

The project-level [DESIGN.md](../DESIGN.md) follows the official Google Stitch DESIGN.md model: it records the visual language, tokens, reusable component behavior, responsive rules, accessibility contract, and visual QA expectations in one implementation-oriented source. The Linear, Airtable, and Raycast references in VoltAgent's `awesome-design-md` collection were reviewed for reusable product principles. JobQuest adopts restrained surface hierarchy, compact keyboard-friendly controls, record-oriented table density, progressive view/filter/group controls, and polished drawers. It does not reproduce proprietary branding, layouts, fonts, logos, or content.

References reviewed:

- https://stitch.withgoogle.com/docs/design-md/
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/airtable.com/DESIGN.md
- https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast.com/DESIGN.md

## Applications table repair

The former table helper escaped every header label. Feature Upgrade 1 inserted column-filter `<button>` strings into those labels, so users saw escaped markup. Applications now use `frontend/application-table.js`, which constructs headers, controls, rows, and user values through DOM APIs and `textContent`. The regression suite verifies that filters and sorting are real buttons, escaped button text is absent, events work, and HTML-shaped company data remains inert.

The table now includes visible selection, Select All with mixed state, server-backed sorting, typed per-column filters, the linked Resume Version, keyboard-openable rows, Quick Preview, and accessible stage movement.

## Shell and navigation

The desktop shell uses a 252px grouped sidebar, a 56px contextual header, live owned-data badges, and a persisted 68px collapsed state. Navigation follows Primary, Activity, Career Assets, Insights, Settings, and manager-only groupings. At tablet/mobile widths it becomes a modal drawer with backdrop, focus entry/trap/restore, Escape handling, and body scroll locking.

## Application preview

Quick Preview opens a safe DOM-built right drawer with application identity, stage, dates, next action, resume version, notes, recent activity, Edit, and Open Full Record. The drawer becomes full-screen on mobile, restores focus when closed, and never interpolates application data as markup.

## Kanban grouping and movement

Kanban view preference, grouping, stage-column collapse, date-group collapse, density, and group render size are stored per user. Supported groupings are Date Applied by day/week/month, Last Updated by day, Next Action Date by day, and None. Calendar grouping uses local date parts, missing dates use “No date,” and collapse state is scoped by grouping mode. Only 15 cards per group render initially; Show More incrementally reveals the remainder.

Stage changes use the centralized backend transition endpoint so application stage, stage history, timeline, and audit records update together. Drag/drop remains available, while the stage dialog provides keyboard and touch alternatives and consequential destinations retain confirmation.

## Dashboard and settings

Dashboard cards share a compact header/action pattern and operational widgets drill into matching Applications, reminders, interviews, follow-ups, or calendar views. The daily goal chart retains actual-versus-immutable-target values in visible text. Dashboard Settings continues to stage edits and includes Select All, mixed state, Deselect All, Restore Defaults, Save Layout, Cancel, drag/drop, keyboard, and touch movement.

Settings remains the home for Profile, PIN & Security, Appearance/workflow defaults, Dashboard, Goals, Reminders, and related controls. All pages inherit centralized light/dark tokens, page headers, cards, forms, tables, states, and responsive shell.

## Database migration

Migration `007_feature_ui_upgrade_1_1.sql` adds only preference data: Kanban grouping, collapsed groups, table density, cards per group, and dashboard visualization JSON. Defaults are backward compatible and no user, authentication, ownership, application, resume, or history records are rewritten. Render continues to apply controlled PostgreSQL migrations through `DIRECT_URL` before starting with pooled `DATABASE_URL`.

## Tests and visual QA

Node tests cover safe header construction, injection resistance, sorting/filter events, local day/week/month grouping, missing dates, preference persistence, ownership, authentication, stage history, and all prior features. Playwright covers the real table, typed filter dialog, preview drawer, Axe accessibility scan, navigation, five responsive viewports, and light/dark/system states.

Committed visual baselines cover dashboard, Applications table, Applications Kanban, expanded/collapsed sidebar, mobile navigation, Application Preview, Settings, application form, aging report, empty state, and themes. CI runs Chromium against an isolated PostgreSQL service and publishes Playwright traces, screenshots, diffs, and the report on failure. Snapshot changes require human review.
