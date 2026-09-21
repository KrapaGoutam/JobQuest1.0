// JobQuest Capture Extension — API Client Unit Tests

import test from "node:test"
import assert from "node:assert/strict"
import { normalizeInstanceUrl } from "../api/jobquest.js"
import { normalizeText, normalizeJobUrl } from "../../backend/src/extension.js"

test("normalizeInstanceUrl: strips trailing slashes and handles empty or prefixless URLs", () => {
  assert.equal(normalizeInstanceUrl(""), "")
  assert.equal(
    normalizeInstanceUrl("http://localhost:3000/"),
    "http://localhost:3000",
  )
  assert.equal(
    normalizeInstanceUrl("http://localhost:3000///"),
    "http://localhost:3000",
  )
  assert.equal(
    normalizeInstanceUrl("https://my-jobquest.onrender.com/"),
    "https://my-jobquest.onrender.com",
  )
  assert.equal(
    normalizeInstanceUrl("localhost:3000"),
    "http://localhost:3000",
  )
  assert.equal(
    normalizeInstanceUrl("  https://jobquest.example.com  "),
    "https://jobquest.example.com",
  )
})

test("normalizeJobUrl: strips utm tracking params, normalizes trailing slashes, case insensitive", () => {
  assert.equal(normalizeJobUrl(""), "")
  assert.equal(
    normalizeJobUrl("https://example.com/jobs/42?utm_source=linkedin&utm_medium=email"),
    "https://example.com/jobs/42",
  )
  assert.equal(
    normalizeJobUrl("https://example.com/jobs/42/"),
    "https://example.com/jobs/42",
  )
  assert.equal(
    normalizeJobUrl("HTTPS://EXAMPLE.COM/JOBS/42"),
    "https://example.com/jobs/42",
  )
  // Preserves legitimate non-tracking query parameters
  assert.equal(
    normalizeJobUrl("https://example.com/job?id=100&utm_campaign=fall"),
    "https://example.com/job?id=100",
  )
})

test("normalizeText: collapses whitespace, trims, lowercases, and safely normalizes punctuation", () => {
  assert.equal(normalizeText(""), "")
  assert.equal(normalizeText("  Acme   Corporation  "), "acme corporation")
  assert.equal(normalizeText("ABC TECHNOLOGIES"), "abc technologies")
  assert.equal(normalizeText(" abc technologies "), "abc technologies")

  // Unicode dashes normalized to ASCII hyphen
  assert.equal(normalizeText("QA Engineer \u2014 Platform"), "qa engineer - platform")
  assert.equal(normalizeText("SDET \u2013 Automation"), "sdet - automation")

  // Curly quotes normalized
  assert.equal(normalizeText("L\u2019Oreal"), "l'oreal")
  assert.equal(normalizeText("\u201CBest\u201D Company"), '"best" company')

  // Special company names preserved safely
  assert.equal(normalizeText("AT&T"), "at&t")
  assert.equal(normalizeText("Johnson & Johnson"), "johnson & johnson")
  assert.equal(normalizeText("H&M"), "h&m")

  // Seniority and distinct titles remain distinct (conservative normalization)
  assert.notEqual(normalizeText("QA Engineer"), normalizeText("Senior QA Engineer"))
  assert.notEqual(normalizeText("QA Analyst"), normalizeText("QA Engineer"))
  assert.notEqual(normalizeText("ABC Technologies"), normalizeText("ABC Consulting"))
})

test("duplicate semantics: classification models four distinct states", () => {
  function classifyMatch({ urlMatches, companyMatches, roleMatches }) {
    if (urlMatches) return "exact_posting"
    if (!companyMatches) return "none"
    if (roleMatches) return "same_role"
    return "company_only"
  }

  // 1. Exact posting match
  assert.equal(
    classifyMatch({ urlMatches: true, companyMatches: true, roleMatches: true }),
    "exact_posting",
  )
  assert.equal(
    classifyMatch({ urlMatches: true, companyMatches: false, roleMatches: false }),
    "exact_posting",
  )

  // 2. Same role at same company
  assert.equal(
    classifyMatch({ urlMatches: false, companyMatches: true, roleMatches: true }),
    "same_role",
  )

  // 3. Company only (same company, different role)
  assert.equal(
    classifyMatch({ urlMatches: false, companyMatches: true, roleMatches: false }),
    "company_only",
  )

  // 4. None (new company)
  assert.equal(
    classifyMatch({ urlMatches: false, companyMatches: false, roleMatches: false }),
    "none",
  )
})

test("resume payload: formatting for existing, manual, and none modes", () => {
  function formatResumePayload(mode, { selectedId, selectedVersion, manualText }) {
    if (mode === "existing") {
      return {
        resume_id: selectedId ? Number(selectedId) : null,
        resume_version: selectedVersion || null,
      }
    }
    if (mode === "manual") {
      return {
        resume_id: null,
        resume_version: manualText ? manualText.trim() : null,
      }
    }
    return {
      resume_id: null,
      resume_version: null,
    }
  }

  // Existing mode with selected resume
  const existing = formatResumePayload("existing", {
    selectedId: "15",
    selectedVersion: "Software Dev v2",
    manualText: "Stale Manual Text",
  })
  assert.equal(existing.resume_id, 15)
  assert.equal(existing.resume_version, "Software Dev v2")

  // Manual mode: ignores selectedId, sets resume_id to null
  const manual = formatResumePayload("manual", {
    selectedId: "15",
    selectedVersion: "Software Dev v2",
    manualText: "QA Automation v96",
  })
  assert.equal(manual.resume_id, null)
  assert.equal(manual.resume_version, "QA Automation v96")

  // None mode: clears both
  const none = formatResumePayload("none", {
    selectedId: "15",
    selectedVersion: "Software Dev v2",
    manualText: "QA Automation v96",
  })
  assert.equal(none.resume_id, null)
  assert.equal(none.resume_version, null)
})

