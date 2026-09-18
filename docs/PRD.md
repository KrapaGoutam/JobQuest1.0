# JobQuest — Product Requirements & Phased Roadmap

Status: Rounds 2–10 implemented — Round 10 (`docs/FEATURE_UPGRADE_10_FINAL.md`) was
the final round of the V2 feature set, combining Analytics with a full release-
hardening capstone (backlog reconciliation, UI/UX, accessibility, security,
performance, refactoring, regression validation, and `development`-vs-`main`
integration planning). Implemented locally on
`feature/010-final-analytics-hardening`, PR into `development` pending; see
[brain/PROJECT_STATE.md](../brain/PROJECT_STATE.md) for current state and
`docs/FINAL_MAIN_INTEGRATION_PLAN.md` for the (not-yet-authorized) `main`
integration step. This status line and the "nothing implemented" note below went
stale for several rounds before being corrected in Round 7 — worth keeping current
going forward. See [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md) for the
discovery this is based on, and [brain/DECISIONS.md](../brain/DECISIONS.md) for the
decisions behind it.

## 1. Vision

JobQuest is evolving from a job-application tracker into a combined **job-search
workspace + personal productivity workspace**, with applications/jobs as the anchor
domain everything else links back to. It stays a secure, multi-user, manually-recorded
tracker (no scraping, no auto-apply) — that scope does not change.

## 2. Ground rules for every round

- Preserve all working behavior, data, and the existing security model.
- Render + Neon infrastructure does not change (see [ARCHITECTURE.md](ARCHITECTURE.md)).
- No React/Radix/shadcn/Tailwind/Framer Motion — vanilla JS, ES modules once Round 2 lands.
- Every round: audit first, gap-list only the delta, then implement — several "new"
  features below already have partial schema/backend (flagged per round).
- Every round ships with: lint, typecheck, unit/integration tests, relevant Playwright
  E2E/accessibility/visual-regression coverage, a production build check, and a
  `docs/FEATURE_UPGRADE_N.md` write-up using the template in §4.
- Branch: `feature/<round>-<slug>` off `development`, merged back via PR (matches the
  repo's existing convention — see [brain/DECISIONS.md](../brain/DECISIONS.md)).

## 3. Phased roadmap

Rounds 1 (Neon migration) and the historical Feature Upgrade 1 / UI Upgrade 1.1 are
already shipped — see `docs/NEON_MIGRATION.md`, `docs/FEATURE_UPGRADE_1.md`,
`docs/FEATURE_UI_UPGRADE_1_1.md`. This roadmap starts at Round 2.

| # | Round | Type | Depends on | Size |
|---|-------|------|------------|------|
| 2 | Frontend build tooling | Infra | — | M |
| 3 | Dashboard + Applications redesign, search/filter/sort/pagination | Product (already spec'd) | 2 | L |
| 4 | Application checklist — gap-close to stage-aware templates | Gap-close | 3 | S–M |
| 5 | Contacts/networking — gap-close to CRM-lite | Gap-close | 3 | S–M |
| 6 | Import/export hardening | Gap-close | 3 | M |
| 7 | Task management (Notion-lite) | Net-new | 3 | M |
| 8 | Habit tracker | Net-new | 3 | S |
| 9 | Journal / notes | Net-new | 3, 7 | M |
| 10 | Analytics module | Net-new | 3, 4 | M |
| 11 | Responsive/design-system capstone pass | Polish | all above | M |

Rounds 10 and 11 as originally planned above were executed together as one combined
final round (`docs/FEATURE_UPGRADE_10_FINAL.md`) — Analytics plus the capstone pass,
broadened into a full release-hardening round (backlog reconciliation, accessibility
root-fixes, a formal security audit, performance audit, refactor/dead-code pass,
full regression validation, and `development`-vs-`main` integration planning), since
by this point in the project a release-readiness pass needed all of that, not just
responsive/design-system polish.

Optional, on request, not sequenced: `docs/design/STITCH_PROMPT.md` — a standalone
prompt package for Google Stitch to explore visual design directions. Plan-only, no
implementation; can be produced independently whenever useful.

### Round 2 — Frontend build tooling

**Goal**: introduce a build step (Vite) for the vanilla JS frontend so subsequent rounds
build cohesive modules instead of growing a single 2726-line `app.js`, with zero product
behavior change.

**Scope**: add Vite config, split `app.js`/`styles.css` into modules by feature area,
wire Render's build command, update `npm run build`/`dev` scripts. No new UI, no new
endpoints, no visual changes.

**Acceptance criteria**: full Playwright visual-regression suite passes with no baseline
changes; accessibility suite unchanged; all existing manual and automated workflows
behave identically; Render deploy succeeds end-to-end in a preview/staging check before
merging to `development`.

### Round 3 — Dashboard + Applications redesign, search/filter/sort/pagination

Already fully specified in the working draft `Feature_Upgrade_2_Codex_Prompt.md`
(untracked, root of repo — the user's own planning doc, not yet executed). Goal: polish
the Dashboard (User + Manager modes) and Applications page, add comprehensive
search/filter/sort/pagination with persisted state, preserving every existing widget
name/type-ID and table field. This round should build on Round 2's module structure
rather than adding more to the monolithic files. Convert that draft into
`docs/FEATURE_UPGRADE_2.md` when the round starts, carrying over its explicit
non-negotiable safety rules.

### Round 4 — Application checklist

**Audit first**: `checklist_items` already exists with backend wiring. Compare its
current shape against the brief's fuller vision — stage-aware templates (Saved,
Ready to Apply, Applied, Interview, Offer, each with a distinct default checklist),
configurable templates, completion tracking. Scope only the gap: likely per-stage
default templates + a small settings UI to customize them, not a new data layer.

### Round 5 — Contacts / networking

**Audit first**: `networking_contacts` already exists. Compare against the brief's
CRM-lite fields (relationship, last interaction, next follow-up, linked
jobs/applications) and scope the gap — this may be mostly a UI/linking round, not schema.

### Round 6 — Import/export hardening

**Audit first**: `import_batches`, `import_rows`, `export_preferences`, and XLSX/CSV/JSON
export already exist (Feature Upgrade 1). Gap to close against the brief: import preview,
field mapping, duplicate detection, partial-failure reporting, and a full-workspace JSON
backup/restore if not already covered. Never silently overwrite records on import.

### Round 7 — Task management

Genuinely net-new (no `tasks` table exists). Lightweight, not a Notion clone: inbox,
today, upcoming, backlog, completed, priorities, due dates, tags, links to applications,
simple subtasks. New table(s), new nav section, reuse the existing ownership/auth model.

### Round 8 — Habit tracker

Genuinely net-new. Optional-to-use, daily/weekly cadence, streaks, user-created habits
alongside job-search-specific suggestions (applications/day, networking contacts/day).
Smallest net-new module — good to sequence early among the net-new set to validate the
"new secondary domain" pattern (schema, nav, dashboard widget) before Round 7/9's larger
surface, or run in either order relative to Round 7 if that proves simpler in practice.

### Round 9 — Journal / notes

Genuinely net-new. Structured daily log + freeform notes, optional linking to a specific
application (interview reflection, recruiter notes, company research). Not a full
document editor — plain structured entries.

### Round 10 — Analytics module

Builds on existing `goal_snapshots`/dashboard-widget data plus Round 3's richer
application data. Funnel, response rate, interview/offer rate, time-to-response,
source/role/location performance. Suppress or caveat metrics when sample size is too
small to be meaningful.

### Round 11 — Responsive / design-system capstone

Full UI/UX audit against [DESIGN.md](../DESIGN.md) across everything shipped in Rounds
3–10: information architecture, spacing/typography consistency, empty/loading/error
states, dark mode, and dedicated desktop/tablet/mobile layout passes (not just shrinking
desktop). Update `DESIGN.md` with any new semantic tokens/patterns introduced along the
way rather than letting them drift undocumented per-round.

## 4. Per-round feature doc template

When a round starts, create `docs/FEATURE_UPGRADE_N.md` with:

`Goal → Scope → Requirements → Design/Architecture → Tasks → Acceptance Criteria →
Tests → Security/Performance Impact → Decisions → Implementation Status`

Only split into separate `SPEC.md`/`PLAN.md`/`TASKS.md`/`TESTS.md`/`DECISIONS.md` files
if a round turns out large enough to genuinely need it (see
[brain/DECISIONS.md](../brain/DECISIONS.md)).

## 5. Spec Kit

Not adopted repo-wide. Evaluate it selectively for whichever round turns out to be the
most architecturally complex in practice (Round 2 or Round 7 are the likeliest
candidates) as a trial, before deciding whether it earns a permanent place here.

## 6. Next safe action

Rounds 2–7 are implemented (see [brain/AGENT_HANDOFF_LOG.md](../brain/AGENT_HANDOFF_LOG.md)
for the round-by-round history). Round 8 (habit tracker) is next up per the table above,
pending the user's explicit go-ahead — no round starts automatically.
