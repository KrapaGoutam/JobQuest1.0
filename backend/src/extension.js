import { rows } from "./db.js"
import { newToken, tokenHash } from "./security.js"
import { createApplication } from "./service.js"

// ---------------------------------------------------------------------------
// Bearer-token authentication for extension endpoints.
// The extension sends: Authorization: Bearer <raw_token>
// We SHA-256-hash it and look it up in extension_tokens.
// ---------------------------------------------------------------------------

function authenticateExtension(db, request) {
  const auth = request.headers["authorization"] || ""
  if (!auth.startsWith("Bearer ")) return null
  const raw = auth.slice(7)
  if (!raw) return null
  const hash = tokenHash(raw)
  const record = db
    .prepare(
      `SELECT et.id, et.user_id, u.username, u.full_name, u.role, u.is_active
       FROM extension_tokens et
       JOIN users u ON u.id = et.user_id
       WHERE et.token_hash = ?
         AND et.revoked_at IS NULL
         AND u.is_active = 1`,
    )
    .get(hash)
  if (!record) return null
  db.prepare(
    "UPDATE extension_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
  ).run(hash)
  return record
}

function requireExtensionAuth(db, request) {
  const actor = authenticateExtension(db, request)
  if (!actor)
    throw Object.assign(new Error("Extension token required"), { status: 401 })
  return actor
}

// ---------------------------------------------------------------------------
// URL normalisation for Level-1 duplicate detection.
// Strips utm_* tracking params, strips trailing slash, lowercases.
// ---------------------------------------------------------------------------

function normalizeJobUrl(rawUrl) {
  if (!rawUrl) return ""
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return rawUrl.trim().toLowerCase()
  }
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^utm_/i.test(key)) parsed.searchParams.delete(key)
  }
  parsed.searchParams.sort()
  let out = parsed.toString().toLowerCase()
  // Strip trailing slash only when there is no query string
  if (!parsed.search && out.endsWith("/")) out = out.slice(0, -1)
  return out
}

function normalizeText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

// ---------------------------------------------------------------------------
// Main handler. Returns (json(...), true) when handled, false otherwise.
// Matches the exact pattern used by handleTasks/handleNotes/handleHabits.
// ---------------------------------------------------------------------------

export async function handleExtension(context, helpers) {
  const { db, request, response, url } = context
  const { json, body, requireAuth } = helpers
  const path = url.pathname

  // ---- Token management routes (session-cookie auth, called from web UI) --

  // POST /api/extension/tokens — generate a new extension bearer token
  if (path === "/api/extension/tokens" && request.method === "POST") {
    const actor = requireAuth(context, { csrf: true })
    const input = await body(request)
    const label = String(input.label || "Extension")
      .trim()
      .slice(0, 80) || "Extension"
    const raw = newToken(32)
    const hash = tokenHash(raw)
    const result = db
      .prepare(
        "INSERT INTO extension_tokens(user_id, token_hash, label) VALUES (?, ?, ?)",
      )
      .run(actor.id, hash, label)
    // Raw token is returned ONCE — never stored, never retrievable again
    return (
      json(response, 201, {
        id: Number(result.lastInsertRowid),
        label,
        token: raw,
        created_at: new Date().toISOString(),
      }),
      true
    )
  }

  // GET /api/extension/tokens — list token metadata (no raw tokens)
  if (path === "/api/extension/tokens" && request.method === "GET") {
    const actor = requireAuth(context)
    const tokens = rows(
      db.prepare(
        "SELECT id, label, created_at, last_used_at, revoked_at FROM extension_tokens WHERE user_id = ? ORDER BY id DESC",
      ),
      [actor.id],
    )
    return (json(response, 200, tokens), true)
  }

  // DELETE /api/extension/tokens/:id — revoke a specific token
  const revokeMatch = path.match(/^\/api\/extension\/tokens\/(\d+)$/)
  if (revokeMatch && request.method === "DELETE") {
    const actor = requireAuth(context, { csrf: true })
    const tokenId = Number(revokeMatch[1])
    const token = db
      .prepare(
        "SELECT id FROM extension_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
      )
      .get(tokenId, actor.id)
    if (!token)
      throw Object.assign(new Error("Token not found"), { status: 404 })
    db.prepare(
      "UPDATE extension_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(tokenId)
    return (json(response, 200, { message: "Token revoked" }), true)
  }

  // ---- Bearer-token extension routes (called from the extension itself) ---

  // GET /api/extension/me — verify auth, return user info
  if (path === "/api/extension/me" && request.method === "GET") {
    const actor = requireExtensionAuth(db, request)
    return (
      json(response, 200, {
        id: actor.user_id,
        username: actor.username,
        full_name: actor.full_name,
        role: actor.role,
      }),
      true
    )
  }

  // GET /api/extension/resumes — list active resumes for selection in popup
  if (path === "/api/extension/resumes" && request.method === "GET") {
    const actor = requireExtensionAuth(db, request)
    const resumes = rows(
      db.prepare(
        "SELECT id, version_name, target_role, job_category, resume_date FROM resumes WHERE user_id = ? AND is_archived = 0 ORDER BY version_name ASC",
      ),
      [actor.user_id],
    )
    return (json(response, 200, resumes), true)
  }

  // GET /api/extension/duplicate-check — check for existing applications
  // Query params: job_url, company, job_title
  if (path === "/api/extension/duplicate-check" && request.method === "GET") {
    const actor = requireExtensionAuth(db, request)
    const jobUrl = String(url.searchParams.get("job_url") || "").trim()
    const company = String(url.searchParams.get("company") || "").trim()
    const jobTitle = String(url.searchParams.get("job_title") || "").trim()

    const matches = []

    // Level 1: Exact normalized URL match
    if (jobUrl) {
      const normUrl = normalizeJobUrl(jobUrl)
      const existing = rows(
        db.prepare(
          "SELECT id, company, job_title, stage, date_applied, location, source, resume_version, priority, updated_at, job_url FROM applications WHERE user_id = ? AND job_url IS NOT NULL",
        ),
        [actor.user_id],
      )
      for (const app of existing) {
        if (normalizeJobUrl(app.job_url) === normUrl) {
          matches.push({ level: 1, match: "exact_url", application: app })
        }
      }
    }

    // Level 2: Exact company + title match (only when no Level-1 match found)
    if (matches.length === 0 && company && jobTitle) {
      const normCompany = normalizeText(company)
      const normTitle = normalizeText(jobTitle)
      const existing = rows(
        db.prepare(
          "SELECT id, company, job_title, stage, date_applied, location, source, resume_version, priority, updated_at, job_url FROM applications WHERE user_id = ?",
        ),
        [actor.user_id],
      )
      for (const app of existing) {
        if (
          normalizeText(app.company) === normCompany &&
          normalizeText(app.job_title) === normTitle
        ) {
          matches.push({ level: 2, match: "company_title", application: app })
        }
      }
    }

    return (
      json(response, 200, { has_duplicate: matches.length > 0, matches }),
      true
    )
  }

  // POST /api/extension/applications — create application from extension
  if (path === "/api/extension/applications" && request.method === "POST") {
    const actor = requireExtensionAuth(db, request)
    const input = await body(request)
    // Reuse existing application validation + creation pipeline from service.js
    const result = createApplication(db, actor.user_id, actor.user_id, input)
    if (result.errors) {
      return (json(response, 400, result), true)
    }
    const created = db
      .prepare("SELECT * FROM applications WHERE id = ?")
      .get(result.id)
    return (json(response, 201, created), true)
  }

  return false
}
