// JobQuest Capture Extension — API Client

/**
 * Normalizes the user-entered JobQuest instance URL.
 * Ensures https:// or http:// prefix and removes trailing slashes.
 */
export function normalizeInstanceUrl(rawUrl) {
  let trimmed = String(rawUrl || "").trim()
  if (!trimmed) return ""
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`
  }
  return trimmed.replace(/\/+$/, "")
}

/**
 * Retrieves saved settings from chrome.storage.local (or browser.storage.local).
 */
export async function getSettings() {
  const storage = typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null
  if (!storage) return { instanceUrl: "", apiToken: "" }
  return new Promise((resolve) => {
    storage.get(["instanceUrl", "apiToken"], (items) => {
      resolve({
        instanceUrl: items.instanceUrl || "",
        apiToken: items.apiToken || "",
      })
    })
  })
}

/**
 * Saves settings to chrome.storage.local.
 */
export async function setSettings({ instanceUrl, apiToken }) {
  const storage = typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null
  if (!storage) return
  const cleanUrl = normalizeInstanceUrl(instanceUrl)
  const cleanToken = String(apiToken || "").trim()
  return new Promise((resolve) => {
    storage.set(
      {
        instanceUrl: cleanUrl,
        apiToken: cleanToken,
      },
      resolve,
    )
  })
}

/**
 * Helper to execute an authenticated fetch to the JobQuest backend.
 */
async function extFetch(instanceUrl, apiToken, path, options = {}) {
  const base = normalizeInstanceUrl(instanceUrl)
  if (!base) throw new Error("JobQuest instance URL is not configured")
  if (!apiToken) throw new Error("Extension API token is not configured")

  const url = `${base}${path}`
  const headers = {
    Authorization: `Bearer ${apiToken.trim()}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers })
  const isJson = (response.headers.get("content-type") || "").includes("application/json")
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const errorMsg =
      (typeof data === "object" && data !== null
        ? data.error || (data.errors && data.errors.join(", ")) || data.message
        : data) || `HTTP ${response.status}`
    throw Object.assign(new Error(errorMsg), { status: response.status, data })
  }

  return data
}

/**
 * Tests connection and authentication by calling GET /api/extension/me.
 * Returns user profile info: { id, username, full_name, role }
 */
export async function testConnection(instanceUrl, apiToken) {
  return extFetch(instanceUrl, apiToken, "/api/extension/me")
}

/**
 * Retrieves the list of active resumes belonging to the authenticated user.
 * Returns: [{ id, version_name, target_role, job_category, resume_date }]
 */
export async function getActiveResumes(instanceUrl, apiToken) {
  return extFetch(instanceUrl, apiToken, "/api/extension/resumes")
}

/**
 * Performs Level-1 and Level-2 duplicate detection against user's applications.
 * Returns: { has_duplicate: boolean, matches: [...] }
 */
export async function checkDuplicate(instanceUrl, apiToken, { job_url, company, job_title }) {
  const params = new URLSearchParams()
  if (job_url) params.set("job_url", job_url)
  if (company) params.set("company", company)
  if (job_title) params.set("job_title", job_title)

  return extFetch(instanceUrl, apiToken, `/api/extension/duplicate-check?${params.toString()}`)
}

/**
 * Retrieves the canonical list of workflow stages and actions supported by JobQuest.
 * Returns: { stages: string[], default: string, workflow_actions: [{ label, value }] }
 */
export async function getStages(instanceUrl, apiToken) {
  return extFetch(instanceUrl, apiToken, "/api/extension/stages")
}

/**
 * Saves a new job application from the extension to JobQuest.
 * Returns: newly created application record with id
 */
export async function createApplication(instanceUrl, apiToken, applicationData) {
  return extFetch(instanceUrl, apiToken, "/api/extension/applications", {
    method: "POST",
    body: JSON.stringify(applicationData),
  })
}

/**
 * Securely constructs a URL within the configured JobQuest instance.
 * Validates protocol (http: or https:) and binds strictly to the configured origin
 * to prevent open redirects to arbitrary domains or javascript: URIs.
 */
export function buildSecureJobQuestUrl(instanceUrl, pathAndQuery = "/") {
  const raw = String(instanceUrl || "").trim()
  if (!raw) {
    throw new Error("JobQuest instance URL is not configured")
  }
  if (/^(javascript|data|vbscript|file):/i.test(raw)) {
    throw new Error("JobQuest instance URL must use http: or https:")
  }

  const cleanBase = normalizeInstanceUrl(raw)
  let parsed
  try {
    parsed = new URL(cleanBase)
  } catch {
    throw new Error("Invalid JobQuest instance URL")
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("JobQuest instance URL must use http: or https:")
  }

  const origin = parsed.origin
  const rawPath = String(pathAndQuery || "/").trim()
  if (rawPath.startsWith("//")) {
    throw new Error("Target destination violates JobQuest instance origin boundary")
  }
  const pathWithSlash = rawPath.startsWith("/") || rawPath.startsWith("#") ? rawPath : `/${rawPath}`
  const target = new URL(pathWithSlash, origin)

  // Double check origin hasn't been altered by path tricks
  if (target.origin !== origin) {
    throw new Error("Target destination violates JobQuest instance origin boundary")
  }

  return target.toString()
}
