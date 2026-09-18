# Security posture & checklist

## Current posture (verified in [CURRENT_STATE_AUDIT.md](../CURRENT_STATE_AUDIT.md))

- Sessions: opaque random tokens, stored only as SHA-256 hashes, 12h expiry,
  HttpOnly/SameSite cookies, `Secure` in production.
- PINs: 4-digit, salted scrypt hashes, 5-attempt lockout (5 min), generic error messages.
- CSRF tokens bound to session, required on all mutations.
- Row-level ownership enforced at the query layer; cross-user access returns `404`, not
  `403`. Client-supplied owner fields are always rejected server-side.
- Roles: `USER` and `MANAGER`; role escalation only via a protected endpoint or the
  env-var-driven seed script — never via public registration or request body.
- CI `security` job: `npm audit --audit-level=high`, plus a grep gate rejecting
  committed `.env`/`.sqlite*` files and raw manager-password- or session-secret-style
  key/value assignments (see `.github/workflows/ci.yml` for the exact pattern — not
  reproduced here verbatim, since it would itself trip the same gate).

This is already a mature posture. New rounds extend it; they do not redesign it.

## Checklist for every new round that adds a table or endpoint

- [ ] New tables carry a `user_id` (or equivalent) ownership column and every query
      filters by the authenticated user unless it's an explicitly manager-only endpoint.
- [ ] New mutation endpoints require the session + CSRF token, same as existing ones.
- [ ] No new endpoint returns another user's data on a not-found path with `403`/`200`
      instead of the existing `404` convention (avoid leaking existence).
- [ ] No secrets, session tokens, or PINs ever appear in logs, error messages, or
      screenshots committed for tests/docs.
- [ ] Any new file upload/import path validates size, type, and content, and never
      executes or evaluates uploaded content.
- [ ] Any new export path escapes formula-control characters in untrusted text fields
      (already done for XLSX export — reuse that helper, don't reimplement it).
- [ ] `npm audit --audit-level=high` stays clean for any new dependency introduced
      (e.g. Vite in Round 2) before merge.
- [ ] Migrations are additive; no round drops or destructively alters existing
      production data without an explicit, separately-approved migration plan.

## Final security report (Round 10, pre-V2-release)

A formal audit closing out the V2 feature set, covering every domain the round
required: authorization, mass assignment, CSRF, XSS, SQL injection, CSV injection,
logging, CSP, and session handling. Full detail (including the per-domain trace and
authorization matrix) is in `docs/FEATURE_UPGRADE_10_FINAL.md`'s Security Audit
section; this is the durable summary for anyone who lands on this file directly.

- **Authorization**: every domain table (Applications, Interviews/Rejections/
  Follow-ups/Networking/Goals, Checklist items, Import batches/rows, Tasks, Habits,
  Notes, Resumes, Exports) enforces owner-scoped list/get/create/update/delete, with
  cross-owner links (e.g. a Task or Note referencing an Application) independently
  re-checked against the same user, not inferred from the parent record alone.
  Managers act cross-user only through an explicit `user_id`/`target_user_id`
  parameter — never implicitly.
- **Mass assignment**: every create/update path rejects client-supplied ownership
  fields (`user_id`, `target_user_id`, `owner_id`) server-side, regardless of what
  the request body contains.
- **SQL injection**: every `${...}`-interpolated SQL fragment across `backend/src/`
  is either a `?`-bound value or a column/table/sort-direction name drawn from a
  hardcoded, regex-anchored whitelist — never raw user input. No injectable path.
- **CSRF**: every mutating route requires `requireAuth(context, { csrf: true })`.
- **Stored XSS**: every user-text field renders through the shared `esc()` helper;
  directly verified with `<script>`/`<img onerror>`-shaped content at both the API
  and E2E layers (Notes).
- **CSV formula injection**: `safeCell()` covers every export path, including every
  tracker type added across the V2 rounds.
- **Sensitive logging**: no request body, password, or PIN is ever logged; 500-level
  errors log server-side only, and the client always receives a generic message.
- **Session/cookie/CSP**: unchanged since Round 1 and still covered by a passing
  test — see "Current posture" above.
- **Dependencies**: `npm audit --audit-level=high` clean on both `backend` and
  `frontend`. One pre-existing MODERATE advisory (`uuid`, transitive via `exceljs`,
  only reachable via a breaking `exceljs` downgrade) is below the release gate and
  accepted as tracked debt, not forced.

**Result: no unresolved CRITICAL or HIGH findings. Not a release blocker.**

## Open questions to resolve per round, not blanket-answered here

- Round 6 (import/export): duplicate-detection and partial-failure handling must never
  silently overwrite existing records — confirm the exact conflict-resolution UX before
  implementing.
- Round 7/8/9 (tasks/habits/journal): confirm whether journal entries linked to an
  application should inherit that application's sharing/visibility rules for managers,
  or stay strictly private to the owning user — this hasn't been decided yet.
