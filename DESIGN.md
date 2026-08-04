# JobQuest Design System

This file is the authoritative visual and interaction contract for JobQuest. It translates the product's job-search workflow into a calm, information-dense workspace. New UI must use these rules and existing UI should move toward them without weakening accessibility, security, or data integrity.

## 1. Product personality

JobQuest is focused, dependable, precise, and encouraging. It should feel like a professional workbench—not a marketing site, game, or generic admin template. Favor clarity, compact rhythm, visible state, and quiet confidence. Progress is acknowledged without confetti or pressure.

## 2. Research synthesis

The system adopts the reusable ideas in Google's Stitch DESIGN.md guidance: keep a project-level design contract concrete enough for consistent implementation, define tokens and reusable patterns, and document responsive and accessibility behavior. From the reviewed Linear reference it adopts disciplined surface layers, hairline borders, compact controls, restrained accent use, and conspicuous keyboard focus. From Airtable it adopts record-oriented density, clear view switching, progressive filtering and grouping, and scannable tables. From Raycast it adopts fast keyboard workflows, polished menus and drawers, and strong dark-theme focus behavior.

JobQuest does not copy proprietary branding, logos, content, exact layouts, or unavailable fonts. It rejects decorative gradients, glass effects, oversized marketing typography, excessive pill shapes, permanently near-black pages, and color as the only status signal.

## 3. Color tokens

Only semantic tokens may be consumed by components.

```css
:root {
  --color-canvas: #f6f7f9;
  --color-sidebar: #ffffff;
  --color-surface-1: #ffffff;
  --color-surface-2: #f1f3f6;
  --color-surface-3: #e8ebf0;
  --color-text: #172033;
  --color-text-muted: #667085;
  --color-text-subtle: #7d8799;
  --color-border: #dfe3ea;
  --color-border-strong: #c7ced9;
  --color-accent: #3157d5;
  --color-accent-hover: #2849b8;
  --color-accent-soft: #e9edff;
  --color-focus: #5076f2;
  --color-success: #147a55;
  --color-warning: #9a5b08;
  --color-danger: #ba3341;
  --color-info: #246b9f;
}

[data-theme="dark"] {
  --color-canvas: #090d16;
  --color-sidebar: #0d1220;
  --color-surface-1: #121827;
  --color-surface-2: #171f30;
  --color-surface-3: #202a3d;
  --color-text: #edf1f7;
  --color-text-muted: #b1bbca;
  --color-text-subtle: #929eb0;
  --color-border: #273247;
  --color-border-strong: #35425a;
  --color-accent: #8098ff;
  --color-accent-hover: #9aacff;
  --color-accent-soft: #202b58;
  --color-focus: #9ab0ff;
  --color-success: #54c89a;
  --color-warning: #edb457;
  --color-danger: #ff7f8c;
  --color-info: #75b8e7;
}
```

Stage and priority colors must be paired with text. Chart colors must be mapped through the same semantic palette and meet contrast requirements against their chart surface.

## 4. Typography

Use `Inter`, `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, sans-serif; do not depend on a network font. Base size is 14px with 1.45 line height. Page titles are 24–28px/1.2, section titles 16–18px/1.3, labels 12–13px/1.3, and dense table content 13px/1.35. Use 600 weight for meaningful hierarchy and 700 sparingly. Use tabular numerals for metrics, dates, and counts.

## 5. Spacing and sizing

Use a 4px base: 4, 8, 12, 16, 20, 24, 32, and 40px. Desktop content gutters are 24px, tablet 20px, mobile 16px. Controls are 32px compact, 36px standard, and at least 44px on touch layouts. Expanded sidebar is 252px; collapsed sidebar is 68px. Content max width is 1600px.

## 6. Radius, border, shadow, and motion

Use 6px for controls, 8px for cards, 10px for dialogs/drawers, and full radius only for status chips or circular icon buttons. Borders are one-pixel semantic hairlines. Shadows are reserved for floating menus, dialogs, drawers, and sticky overlap. No gradients. Motion is 120–180ms with ease-out for entry and ease-in for exit; respect `prefers-reduced-motion` and never animate essential information.

## 7. Application shell

Desktop uses a persistent sidebar, a 56px top bar, and a fluid main canvas. The sidebar contains brand/workspace, grouped navigation, live badges, and the user area. Its sections are Primary (Dashboard, Applications, Add), Activity (Calendar, Reminders, Interviews, Rejections, Follow-Ups, Networking), Career Assets (Resumes, Bulk Import), Insights (Goal History, Aging, Stage Analytics, Exports), Settings, and Manager when authorized. Goal settings lives inside Settings. Collapsed mode preserves accessible names via tooltips.

Below 768px, replace the sidebar with a modal drawer and backdrop. Opening moves focus into it, Tab is trapped, Escape/backdrop closes it, and close restores focus. The top bar retains page identity and primary action without horizontal overflow.

## 8. Navigation

Navigation rows are 36–40px, left aligned, and use an icon, label, optional live badge, and selected indicator. Badges are concise and derived from current owned data. The selected state uses accent-soft plus a visible edge, not color alone. Sidebar scrollbars are thin and theme-aware.

## 9. Page header

Every major page has one header: eyebrow or breadcrumb when useful, a single `h1`, one-line supporting copy, and no more than one primary action. Secondary actions belong in an overflow/menu or toolbar. On mobile actions wrap below the title.

## 10. Buttons and controls

Primary buttons use the accent and appear once per action cluster. Secondary and ghost buttons carry lower emphasis; danger styling is reserved for destructive confirmation. Icon-only buttons require accessible names and tooltips. All controls have hover, active, disabled, and `:focus-visible` states. Native prompts are transitional only; new filters, movement, and previews use product dialogs, popovers, or drawers.

## 11. Cards and metrics

Cards use surface-1, a hairline border, 8px radius, and 16–20px padding. Avoid nesting multiple card borders. Metric cards contain label, primary tabular value, short context, and an optional drill-through action. Empty states explain the absence and offer a relevant action.

## 12. Tables

Tables prioritize company/job title, then stage and next action; dates remain quieter. Headers are sticky where useful and always built with safe DOM APIs. Sort is a real button with direction and `aria-sort`; filters are adjacent accessible buttons opening typed filter controls. Cells containing user data use `textContent`. Rows support hover, focus, selection, and Quick Preview without making nested controls trigger the row. The Resume Version column displays the linked version or “No resume linked.” Mobile uses controlled horizontal scrolling or a compact record layout—never clipped content.

## 13. Filters, view controls, and saved views

Table/Kanban is a segmented control with persisted selection. Keep search, stage, priority, and More Filters in the compact toolbar. Advanced filters use field-appropriate controls: text operators, enum multiselect, date ranges, booleans, and numeric comparisons. Active filters appear as removable chips and Clear All is visible. Saved views include filters, sorting, grouping, and view mode.

## 14. Drawers, dialogs, menus, and tooltips

The Application Preview drawer is 420–520px on desktop and full-screen on mobile. It shows identity, stage, dates, next action, resume, notes summary, activity, and Edit/Open actions. Drawers and dialogs have labelled headings, close buttons, focus traps, Escape handling, backdrop dismissal where safe, and focus restoration. Menus use roving keyboard focus. Tooltips supplement—not replace—accessible names.

## 15. Kanban

Columns are visually quiet containers with sticky stage headers, count, collapse control, and bounded contents. Cards show company, role, resume, priority, applied date, next action, and overdue status. Cards are movable by drag/drop plus a keyboard/mobile stage menu. Consequential transitions require confirmation. Drop success updates stage, history, timeline, and audit together; failure restores the source state.

Within each stage, grouping modes are Date Applied by day/week/month, Last Updated by day, Next Action Date by day, or None. Group headers show label and count and are independently collapsible. Collapse state persists per user and grouping mode. Render 15 cards initially per group and add “Show more”; do not put hundreds of hidden cards in the DOM. Empty-date records use an explicit “No date” group.

## 16. Dashboard

Dashboard hierarchy is: current status metrics; today's focus; application activity; funnel/stage overview; goal performance; work queue. Every interactive visualization exposes a button/link equivalent and drill-throughs carry the matching Applications filters. Daily goals compare actual versus immutable target snapshots and include text values, not color alone. Widgets share header, context, visualization, empty/error/loading states, and optional footer action. Layout controls remain Select All, Deselect All, Restore Defaults, Save Layout, and Cancel.

## 17. Forms

Use logical sections, persistent labels, short help text, clear required markers, inline errors connected with `aria-describedby`, and a stable action footer. Do not rely on placeholder text as a label. Preserve entered values after validation failures. PIN fields retain exact four-digit numeric semantics and password-manager-friendly attributes.

## 18. Settings

Settings uses a secondary navigation for Profile, PIN & Security, Appearance, Dashboard, Goals, Reminders, Follow-Ups, Application Defaults, and Manager-only settings. Each section has a clear title, short explanation, grouped controls, save feedback, and Cancel/reset behavior where edits are staged.

## 19. Charts and timelines

Charts use semantic tokens, visible axes/labels where relevant, text summaries, and keyboard-accessible drill-throughs. Never convey meaning by hue alone. Timelines use a vertical rule, event icon, title, timestamp, actor/source, and optional detail; newest-first ordering must be stated. Dense reports retain table alternatives.

## 20. Loading, empty, error, and success states

Use skeletons only when layout is known; otherwise use concise status text with `aria-live`. Empty states distinguish no data from no filter matches. Errors state what failed and provide Retry when safe. Success uses non-blocking live-region toasts, while destructive or consequential actions require explicit confirmation.

## 21. Responsive behavior

Breakpoints are behavioral: compact desktop at 1024px, tablet at 768px, and mobile below 600px. Grids reduce columns progressively; toolbars wrap; drawers become full-screen; touch controls become 44px; tables scroll with an affordance; Kanban remains horizontally navigable with stage movement controls. No page may create viewport-level horizontal overflow.

## 22. Accessibility

Target WCAG 2.2 AA. Maintain landmarks and heading order, skip navigation, visible focus, 4.5:1 normal text contrast, 3:1 large text/UI contrast, labelled controls, live feedback, and full keyboard operation. Selection and collapse expose checked/expanded states. Drag/drop always has non-pointer alternatives. System theme follows OS changes while selected, and all three theme modes remain readable.

## 23. Safe rendering and security

Prefer `createElement`, `textContent`, explicit attributes, and small reviewed component builders. Do not interpolate untrusted data into `innerHTML`, event-handler attributes, CSS, or URLs. Validate server-side ownership and authorization regardless of hidden controls. External URLs must be protocol-validated and opened with safe rel attributes.

## 24. Performance

Bound list and Kanban rendering, paginate server queries, debounce search, and avoid full-shell replacement when a local component update is sufficient. Keep event listeners scoped and remove transient overlays. Prefer CSS layout over measurement loops. Preserve responsive interaction on free-tier Render/Neon cold starts with explicit loading and retry states.

## 25. Visual QA contract

Maintain visual snapshots for dashboard, Applications table, Applications Kanban, expanded/collapsed navigation, mobile navigation, preview drawer, settings, forms, reports, light, dark, and system themes at 1440, 1024, 768, 390, and 360px as applicable. Snapshot updates require human review. Also test focus, contrast, overflow, long content, empty states, and large datasets; screenshots alone do not establish accessibility or functional correctness.
