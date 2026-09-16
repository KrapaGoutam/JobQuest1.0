# Backlog

Mirrors [docs/PRD.md](../docs/PRD.md) §3. Update status here as rounds move; keep the
detailed spec in the round's own `docs/FEATURE_UPGRADE_N.md` once it starts.

| # | Round | Status |
|---|-------|--------|
| 2 | Frontend build tooling (Vite, ES modules, zero behavior change) | Merged (PR #9, regular merge into `development`) |
| 3 | Dashboard + Applications workspace (info hierarchy + quick filters; most of the draft prompt's search/filter/sort/export wishlist turned out already implemented — see `docs/FEATURE_UPGRADE_3.md`) | Merged (PR #10) |
| 4 | Application checklist — full CRUD (edit/delete/reorder), validation, lifecycle-phase display grouping; stage-aware *generation* deferred — see `docs/FEATURE_UPGRADE_4.md` | Merged (PR #11) |
| 5 | Contacts/networking — fixed the broken application-linkage flow, added Edit UI, surfaced contacts on application detail; backend CRUD/security was already solid — see `docs/FEATURE_UPGRADE_5.md` | Implemented locally; PR pending |
| 6 | Import/export hardening — preview, mapping, duplicate detection, JSON backup/restore | Not started |
| 7 | Task management (Notion-lite) | Not started |
| 8 | Habit tracker | Not started |
| 9 | Journal / notes | Not started |
| 10 | Analytics module | Not started |
| 11 | Responsive/design-system capstone pass | Not started |

Not sequenced, on request only: `docs/design/STITCH_PROMPT.md` (Google Stitch prompt
package, plan-only).

## Smaller items discovered during Round 3 (not yet sequenced into a round)

- "Interviews This Week" / "Follow-ups Due" quick filters (need `interviews`/
  `follow_ups` joins — bigger than a params-only quick filter). See
  `docs/FEATURE_UPGRADE_3.md` Known Debt.
- Salary-range filter UI — blocked on a product decision about currency/period
  normalization, not just a UI gap. See same doc.
- Decide whether to deprecate `GET /api/applications` (the pre-Feature-Upgrade-1 listing
  endpoint) now that its only frontend caller was removed as dead code.

## Smaller items discovered during Round 4 (not yet sequenced into a round)

- Note "add/edit" UI control for checklist items (backend field + PATCH support exist;
  no frontend control reaches it beyond the initial completion toggle). See
  `docs/FEATURE_UPGRADE_4.md` Known Debt.
- Stage-aware checklist *generation* (today's display-only lifecycle grouping is safe;
  actually varying which defaults get created per stage needs either fragile
  label-matching or a schema change, deferred pending real product need).
- Configurable checklist templates — no verified need yet beyond the one fixed set.
- Dashboard integration of checklist completion/progress — deferred to avoid an N+1
  query pattern across the application list; needs a deliberate efficient query shape
  if pursued.
- **`#detail-stage` (application detail page's stage-change dropdown) has no accessible
  name** — real, critical-impact, pre-existing WCAG violation, found while scoping
  Round 4's new E2E test but left unfixed (unrelated to checklists; the rest of the
  detail page likely has more of the same pattern and deserves a dedicated audit, not a
  one-off fix here). Cheap to fix whenever someone picks it up.
- Cross-group checklist reordering has no visible effect in the grouped display (group
  membership is decided by label, not `position`) — not a bug, but worth knowing if the
  grouping/reorder interaction is ever revisited. See `docs/FEATURE_UPGRADE_4.md`.

## Smaller items discovered during Round 5 (not yet sequenced into a round)

- **Edit UI gap for interviews/rejections/follow_ups/daily_goals/weekly_goals** — same
  "no edit control in the UI, backend already supports PATCH" gap this round closed for
  networking_contacts, identically present for every other type sharing the generic
  `renderTracker` view. See `docs/FEATURE_UPGRADE_5.md`.
- No accessibility audit of the other `renderTracker`-based pages (interviews,
  rejections, follow_ups, goals, resumes, reminders) — only Networking and the
  application-detail page were scanned this round.
- Contact search/filter/sort and duplicate-contact detection — deferred, no evidence of
  need at current scale.
- `job_url` on the application detail page has the same unvalidated-external-link-
  protocol pattern `linkedin_url` had before this round — noticed in passing, not fixed
  (application field, not a contact field — out of scope).
