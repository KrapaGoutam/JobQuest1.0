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

## Open questions to resolve per round, not blanket-answered here

- Round 6 (import/export): duplicate-detection and partial-failure handling must never
  silently overwrite existing records — confirm the exact conflict-resolution UX before
  implementing.
- Round 7/8/9 (tasks/habits/journal): confirm whether journal entries linked to an
  application should inherit that application's sharing/visibility rules for managers,
  or stay strictly private to the owning user — this hasn't been decided yet.
