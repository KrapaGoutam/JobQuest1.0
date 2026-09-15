# Backlog

Mirrors [docs/PRD.md](../docs/PRD.md) §3. Update status here as rounds move; keep the
detailed spec in the round's own `docs/FEATURE_UPGRADE_N.md` once it starts.

| # | Round | Status |
|---|-------|--------|
| 2 | Frontend build tooling (Vite, ES modules, zero behavior change) | Merged (PR #9, regular merge into `development`) |
| 3 | Dashboard + Applications workspace (info hierarchy + quick filters; most of the draft prompt's search/filter/sort/export wishlist turned out already implemented — see `docs/FEATURE_UPGRADE_3.md`) | Merged (PR #10) |
| 4 | Application checklist — full CRUD (edit/delete/reorder), validation, lifecycle-phase display grouping; stage-aware *generation* deferred — see `docs/FEATURE_UPGRADE_4.md` | Implemented locally; PR pending |
| 5 | Contacts/networking — audit + gap-close to CRM-lite | Not started |
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
