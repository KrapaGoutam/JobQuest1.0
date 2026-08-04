# Feature Upgrade 1

JobQuest now provides a shared, owner-scoped Applications workspace with persisted Table and Kanban views. Table is the default, includes the linked Resume Version, supports compact column filters and a global advanced filter bar, and keeps server pagination. Kanban uses the same filter query, the centralized stage transition, horizontally scrolling stage columns, persisted collapsed columns, drag-and-drop, and a keyboard/touch-friendly **Move to stage** action. Consequential closed-stage moves require confirmation; rejection moves reuse the rejection workflow and stage, timeline, and audit records are written atomically.

## Navigation and settings

Primary navigation emphasizes Dashboard, Applications, Add Application, Bulk Import, and Calendar. Goal Settings is consolidated under Settings alongside Profile, PIN and Security, Appearance, Dashboard, Reminder, Follow-Up, and application defaults. Navigation badge counts and preferences are server-side and owner-scoped. Responsive styles provide a touch-friendly application table and board, and reduced-motion preferences are honored.

## Resume revisions and goals

Migration `006_feature_upgrade_one.sql` adds resume parent/revision metadata, active/default flags, change summaries, and an immutable resume-history table. APIs support cloning, history retrieval, and authorized metadata/performance comparison. Files remain metadata-only because Render's filesystem is ephemeral.

The configurable `daily-goal-chart` dashboard widget reads historical goal snapshots through `/api/goals/progress-series`. It distinguishes achieved and missed periods without relying only on color and handles empty or zero-target data.

## Exports

CSV and versioned JSON remain available. `/api/exports/applications.xlsx` creates a genuine XLSX workbook with typed dates and numbers, wrapped text, styled and frozen headers, auto-filtering, and a Summary sheet when multiple records are exported. Date ranges and shared filters are enforced server-side. Formula-control characters in untrusted text are escaped, and authentication/session/database secrets are excluded.

## Verification and deployment

New endpoint groups cover application query/Kanban/view preferences, board order, navigation counts/preferences, resume clone/history/compare, goal progress series, and Excel export. Mutations use authentication, CSRF, validation, and ownership checks. The additive migration preserves existing Neon data and does not restore SQLite runtime behavior.

From `backend`, run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm audit --audit-level=high`. CI applies migrations to isolated PostgreSQL and validates the SQLite-to-PostgreSQL fixture without production Neon credentials.
