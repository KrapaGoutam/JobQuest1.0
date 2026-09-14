# Project state

Last updated: 2026-09-14, by Claude Sonnet 5 (Claude Code).

## Branch / commit

- Working branch: `docs/v2-planning-foundation` (off `main`), not pushed.
- Last known passing commit on `main`: `7b674f4` (merge of
  `bugfix/pg-pool-connection-crash`) — CI was green there per repo history; not
  independently re-run this session.
- `development` is the repo's existing integration branch for feature work (see
  `.github/workflows/ci.yml` triggers and merged-PR history).

## What's done

- Phase 0 discovery complete: [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md).
- Planning-foundation docs added (this commit): `AGENTS.md`, `docs/PRD.md`,
  `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `tasks/`, `brain/`.
- No application code, migrations, or infrastructure changed.

## Incomplete / not started

Every round in [docs/PRD.md](../docs/PRD.md) §3 (Rounds 2–11). See
[tasks/BACKLOG.md](../tasks/BACKLOG.md) for status per round.

## Known state to be aware of

- Five untracked "mega-prompt" planning files sit at repo root (`Feature_Upgrade_2_Codex_Prompt.md`,
  `HEADROOM.md`, `JOBSEARCH_MANAGER_FEATURE_UPGRADE_1.1_PROMPT.md`,
  `JOBSEARCH_MANAGER_FEATURE_UPGRADE_1_PROMPT.md`,
  `JOBSEARCH_MANAGER_NEON_MIGRATION_UPDATE_PROMPT.md`). These are the user's own working
  drafts, deliberately not committed (see `f432aa3`). Do not commit them as part of this
  work; `Feature_Upgrade_2_Codex_Prompt.md` specifically is the source for Round 3's scope.
- `ui-upgrade` branch exists locally/remotely; not yet confirmed whether it's merged or
  still carries unlanded work — check before assuming it's safe to ignore or delete.

## Blockers

None. Waiting on the user to pick a starting round (Round 2 recommended) before any
feature branch or code change begins.

## Next safe action

Once the user confirms: create `feature/2-frontend-build-tooling` off `development`,
write `docs/FEATURE_UPGRADE_02.md` from the template in `docs/PRD.md` §4, then implement.
