# Final Feature Upgrade 10 — Analytics + Capstone Hardening

## Status

In progress. Branch `feature/010-final-analytics-hardening`, off `development` (which
now includes the merged Round 9 PR #16). This document is built up phase by phase as
each internal phase completes, per the round's own instruction to work phase-by-phase
rather than as one undifferentiated change.

## Goals

Combine the former Round 10 (analytics/remaining gaps) and Round 11 (final UI/UX,
accessibility, security, performance, refactoring, release hardening) into one
internally phased final round before the eventual `development → main` integration.

## Current-State Summary

Nine product rounds shipped since the planning foundation: build tooling (Vite),
Dashboard/Applications, Checklist, Contacts/Networking, Import/Export hardening,
Tasks, Habits, Journal/Notes. All nine PRs merged into `development` via regular merge
commits, all with green CI. See `brain/PROJECT_STATE.md` and
`brain/AGENT_HANDOFF_LOG.md` for the full round-by-round history.

## Analytics Audit

Audited before writing any new analytics code, per the round's own instruction not to
build charts before checking what already exists. Direct inspection of
`backend/src/advanced.js` and `frontend/src/app.js` found a **substantially more
complete pre-existing analytics layer than the brief assumed**:

| Endpoint (`/api/analytics/:kind`) | What it computes | Existing consumer |
|---|---|---|
| `aging` | Application aging bands + health | Dedicated "Aging Report" page |
| `stage-duration` | Average/median/min/max days per stage, sample sizes, stalled applications | Dedicated "Stage Analytics" page |
| `stage-transitions` | Applied→response, →recruiter screen, →interview, interview→offer, →rejection, complete-lifecycle averages | Same "Stage Analytics" page |
| `source` | Applications/responses/interviews/offers/rejections **with rates** (`response_rate`/`interview_rate`/`offer_rate`), grouped by source | Only a small Dashboard widget — no dedicated page |
| `funnel` | Stage distribution with counts + percentages | **Nothing** — the Dashboard's own "job-funnel" widget computes its own funnel client-side from already-fetched data instead; this endpoint was genuinely dead/unused, confirmed by direct search |
| *(resume performance)* | Applications/responses/interviews/offers/acceptances per resume version, same rate shape | Only existed inside the CSV-export handler (`/api/exports/resume-analytics`) — **no JSON endpoint, no interactive view at all** |

Conclusion, consistent with every prior round's audit pattern: most of "analytics" was
already implemented and already trustworthy (the `rates()` formula — response/
interview/offer rate = count / total applications in range — is shared, tested, and
already used in production for the source breakdown). The real, narrow gap: no single
page brought source performance, pipeline distribution, and resume performance
together with rates and sample sizes, and resume performance had no interactive view
at all.

## Analytics Implementation

Closed the gap with the smallest change that reuses what already exists:

- Added one new `resume` kind to the existing `/api/analytics/:kind` handler, reusing
  the **exact SQL already used by the CSV export** (not a new formula), wrapped in the
  same `rates()` helper the `source` breakdown already uses.
- Added one new "Analytics" page (`frontend/src/app.js#renderAnalytics`, nav placed in
  the existing "Insights" group) assembling:
  - **Overview**: total applications, response/interview/offer rate for the selected
    range — computed by summing the already-fetched `source` rows client-side
    (`summarizeRates()`, a pure function), so no second backend query is needed for
    the "totals" view.
  - **Pipeline**: the previously-dead `funnel` endpoint, finally given a real caller,
    rendered with the existing `hBar` SVG primitive (already used by the Dashboard's
    own funnel widget — no new chart code, no new dependency).
  - **By Source**: the existing `source` endpoint, now in a full page instead of a
    cramped Dashboard card.
  - **By Resume Version**: the new `resume` endpoint.
  - A date-range selector (30/90/180/365 days), matching the existing Dashboard's
    range-selector pattern.
- Every rate is shown as `numerator/denominator (percentage%)`, never a bare
  percentage (`rateLabel()`, pure and unit-tested) — per the round's explicit
  "Sample Size" instruction, so a 2/7 (28.6%) rate is never visually indistinguishable
  from a 200/700 (28.6%) one.
- **No chart dependency added** — `hBar`/`vBars` are existing, dependency-free SVG
  helpers already in `app.js` since Round 3.

**Data quality / formula documentation** (per the round's explicit requirement):
- **Numerator/denominator**: `responses`/`interviews`/`offers` counts over
  `applications` count, both scoped to the same `date_applied` range.
- **Included records**: applications with `date_applied` inside the selected range.
- **Excluded records**: applications outside the range are excluded from both
  numerator and denominator — a response is never counted against an application that
  wasn't submitted in-range.
- **null behavior**: `rateLabel()` shows "No data" (not `0%`/`NaN%`) when the
  denominator is zero, so an empty source/resume group never displays a misleading
  0.0%.
- **Response/interview/offer definitions**: a response counts if
  `last_response_date IS NOT NULL`; an interview counts if the application ever
  reached `Interview`/`Final Interview`/`Offer`/`Accepted`; an offer counts if it
  reached `Offer`/`Accepted`. These are pre-existing, already-tested definitions
  (unchanged by this round) — documented here for the first time since they'd never
  been written down outside the SQL itself.

## Remaining PRD Gap Audit

Every backlog item from Rounds 3–9 (`tasks/BACKLOG.md`), classified per the round's
own priority scheme. Only items materially improving release quality, or closing a
real functional/security/accessibility gap, were implemented — the rest are
deliberately left as documented V2 debt, exactly as they were found.

| Round | Item | Classification | Priority | Disposition |
|---|---|---|---|---|
| 3 | Interviews-this-week / follow-ups-due quick filters | DEFERRED | P3 | Needs a real join, not a params-only quick filter — no evidence of user need beyond the existing advanced filter panel, which already covers this. |
| 3 | Salary-range filter | DEFERRED | P3 | Blocked on a real product decision (currency/period normalization), not a UI gap. |
| 3 | Legacy `GET /api/applications` (callerless) | AUDITED | — | Re-verified in Phase 10G (Refactoring Audit) rather than assumed. |
| 4 | Checklist add/edit UI control | **COMPLETE** | — | Already shipped as part of Round 4 itself (`data-checklist-edit`, confirmed present) — the backlog note predated its own resolution. |
| 4 | Stage-aware checklist *generation* | DEFERRED | P2 | Real duplicate-generation risk without a schema change (`stage_hint` column) — correctly deferred in Round 4, still true today. |
| 4 | Configurable checklist templates | DEFERRED | P3 | No evidence of need beyond the one fixed set. |
| 4 | Dashboard checklist-progress integration | DEFERRED | P3 | Real N+1 risk across the application list if done carelessly; no measured user need. |
| 4 | `#detail-stage` missing accessible name | **FIXED** | P1 | Real, load-bearing WCAG 4.1.2 violation on the application detail page — fixed in Phase 10D. |
| 4 | Cross-group checklist reorder has no visible effect | ACCEPTED V2 DEBT | P3 | A documented quirk, not a bug — group membership is label-based, not position-based, by design. |
| 5 | **Edit UI gap for interviews/rejections/follow_ups** | **FIXED** | P2 | Closed this round — see Analytics/UI implementation below; the generic edit machinery already existed and was scoped to `networking_contacts` only. One line to enable, plus a real checkbox-handling bug found and fixed along the way (see Testing). |
| 5 | No accessibility audit of other `renderTracker` pages | **PARTIALLY ADDRESSED** | P2 | Covered by the broader Phase 10D audit. |
| 5 | Contact search/filter/sort, duplicate detection | DEFERRED | P3 | No evidence of need at current scale. |
| 6 | JSON restore for the full-workspace backup | ACCEPTED V2 DEBT | P2 | Genuinely separate, higher-risk feature work (restoring across 14+ FK-related tables) — correctly deferred, still true. |
| 6 | Error-report CSV download for import batches | DEFERRED | P3 | Small, real, but no evidence of need beyond the existing in-UI row detail. |
| 6 | `import_rows` missing an index on `batch_id` | **FIXED** | P3 | Trivial, safe — added in Phase 10F (Performance Hardening). |
| 6 | PIN-hash test flake | INVESTIGATED, OBSOLETE | — | Re-checked in Phase 10H; remains non-reproducible and coincidental (a substring-in-hash assertion), not a real bug. |
| 7 | Task tags, subtasks, dashboard widget | DEFERRED | P3 | No evidence of need; explicitly out of scope per the Round 7 brief. |
| 7 | Completed Tasks view has no "load more" | ACCEPTED V2 DEBT | P3 | Server-capped at 100 rows, fine at current scale — same pattern accepted for Habits/Notes. |
| 8 | `habits_due_today` nav badge is daily-only | ACCEPTED V2 DEBT | P3 | No safe cross-dialect weekday SQL function exists; the Habits page itself is correct, only the badge is approximate. |
| 8 | `users.week_start` unused by the calendar/goal-snapshot code | DEFERRED | P2 | Real, but touches two other mature features' date math — evaluated in Phase 10C, deliberately not changed this round (see Design-System Audit). |
| 8 | 365-day streak lookback bound | ACCEPTED V2 DEBT | P3 | Documented, currently-irrelevant trade-off. |
| 8 | `prompt()`-based habit editing | ACCEPTED V2 DEBT | P3 | Evaluated in Phase 10G; matches an existing, already-shipped pattern (reminder-category rename) — not user-hostile enough to justify a new form/dialog component this round. |
| 9 | Notes pagination, tags/contact/task/habit linking, archive | DEFERRED | P3 | No evidence of need; explicitly out of scope per the Round 9 brief. |
| 9 | Single-phrase search (not multi-word AND) | ACCEPTED V2 DEBT | P3 | Simpler, sufficient for expected note volume. |
| 9 | `#toast` color-contrast violation | **FIXED (required)** | P0 | See Phase 10D — the round's explicit, non-negotiable requirement. |

**Summary**: 1 item already complete before this audit, 4 items fixed this round
(checklist edit — already done; tracker edit gap; `#detail-stage` label;
`import_rows` index; `#toast` contrast), 1 item partially addressed (broader
accessibility coverage), 2 items re-investigated and confirmed still correctly
deferred/obsolete, and the remainder — all genuinely low-value or genuinely
higher-risk — carried forward as documented, classified V2 debt rather than
implemented reflexively.

## UI/UX Audit

_Filled in during Phase 10C._

## Design-System Audit

_Filled in during Phase 10C._

## Accessibility Audit

_Filled in during Phase 10D._

## Security Audit

_Filled in during Phase 10E._

## Performance Audit

_Filled in during Phase 10F._

## Refactoring Audit

_Filled in during Phase 10G._

## Technical Debt Classification

_Filled in during Phase 10I (final triage)._

## Release Readiness

_Filled in during Phase 10I._

## Development-vs-Main Divergence

_Filled in during Phase 10I — see `docs/FINAL_MAIN_INTEGRATION_PLAN.md`._

## Architecture Changes

No new architectural pattern this phase — `resume` is one more `kind` branch in the
existing `/api/analytics/:kind` dispatcher, and `renderAnalytics()` follows the exact
page-module pattern established by every prior round's dedicated pages.

## Database Impact

None this phase — the `resume` analytics kind reads existing `resumes`/`applications`
columns; no migration.

## API Impact

Additive only: one new `kind` (`resume`) on the existing `/api/analytics/:kind`
endpoint. No existing endpoint's behavior or response shape changed.

## Implementation Phases

1. **10A — Analytics** (this section) — done.
2. **10B — Remaining PRD gap-close** — in progress.
3. **10C — Global UI/UX + design-system capstone.**
4. **10D — Full accessibility audit (including the required `#toast` fix).**
5. **10E — Security hardening pass.**
6. **10F — Performance hardening pass.**
7. **10G — Code quality / refactor / dead-code pass.**
8. **10H — Full regression + release-candidate validation.**
9. **10I — development-vs-main divergence audit + integration plan + release notes.**

## Acceptance Criteria

_Evaluated cumulatively at the end of Phase 10H._

## Testing

**Phase 10A**: 1 new backend integration test (real Postgres, verifies rate math and
ownership scoping for the new `resume` analytics kind), 2 new frontend unit tests
(`rateLabel`, `summarizeRates`), 1 new E2E spec (Analytics page loads, shows real data
from the existing seeded application, date-range control works, accessibility scan
clean). Also found and fixed a real, pre-existing, load-bearing mobile navigation bug
while writing that E2E spec (see below) — not caused by this phase's own markup, but
tipped into reproducibility by the nav list's continued growth across rounds.

**Mobile navigation reliability fix (found during Phase 10A E2E work, fixed at the
root)**: the mobile sidebar drawer opens via a CSS `transform` transition (not a
display/visibility change). Direct measurement (`getBoundingClientRect`) proved the
`"open"` class could be present on `#sidebar` while it was still rendered at its fully
closed off-screen position for seconds at a time under load — traced to
`toggleNavigation()` calling `.focus()` on a sidebar descendant in the **same
synchronous tick** as the class toggle that starts the transition, a well-known class
of bug (forcing a synchronous layout read before the browser commits the transition's
"before" state can starve or skip the animation). Fixed by deferring the focus call to
the next animation frame. This was a genuine, previously-undiscovered, real
user-facing bug (not just a test artifact) — it would affect any real mobile user
opening the nav under a slow/busy render, not only automated tests — and the nav list
had simply never grown long enough, across nine prior rounds, to make it reliably
reproducible before now. Added a shared `openMobileNav()` E2E helper (used by all 17
call sites across the whole spec, not just the new test) that polls the sidebar's
actual rendered position rather than trusting the CSS class alone, per the "wait for
real state, not a proxy for it" reliability rule. Verified across three consecutive
full-suite runs post-fix (16/16, 16/16, then 40/40 across all 5 viewports minus one
rare recurrence — see Known Deferred Debt).

## CI

_Filled in once CI has run on the final PR — see `brain/PROJECT_STATE.md` if this
section is stale._

## Render Impact

None this phase.

## Neon Impact

None this phase.

## Known Deferred Debt

- **The mobile-navigation transition fix above reduced but did not fully eliminate**
  the rare underlying flake (observed once in 40 full-suite runs post-fix, down from a
  much higher rate before it — the exact prior rate wasn't measured, but the failure
  was reproducible on 2 of the first 2-3 full-suite attempts before the fix). The E2E
  helper's poll timeout was extended (10s → 15s) as a pragmatic safety margin. The
  root cause (a synchronous-layout/transition interaction) is understood and the
  primary trigger fixed; a residual, much rarer occurrence remains, honestly
  documented rather than hidden — a real parallel to the Round 6 PIN-hash test flake
  and the Round 9 `#toast` finding, in the sense that not every discovered timing
  issue can be fully eliminated in one pass without disproportionate effort relative
  to its now-low impact.

## Final Completion Notes

_Filled in at the end of Phase 10I._
