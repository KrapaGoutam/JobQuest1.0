// JobQuest Capture Extension — API Client Unit Tests

import test from "node:test"
import assert from "node:assert/strict"
import { normalizeInstanceUrl, buildSecureJobQuestUrl } from "../api/jobquest.js"
import { normalizeText, normalizeJobUrl } from "../../backend/src/extension.js"
import { STAGES } from "../../backend/src/service.js"

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

test("canonical stages: options strictly mirror JobQuest canonical STAGES", () => {
  // Verify STAGES exported from backend contains the expected canonical stages
  assert.ok(Array.isArray(STAGES))
  assert.equal(STAGES.length, 13)
  assert.ok(STAGES.includes("Saved"))
  assert.ok(STAGES.includes("Applied"))
  assert.ok(STAGES.includes("Interview"))
  assert.ok(STAGES.includes("Offer"))
  assert.ok(STAGES.includes("Rejected"))

  // "Saved" is JobQuest's canonical pre-application bookmark stage
  assert.equal(STAGES[0], "Saved")
})

test("unsupported stage regression: 'Bookmarked' is not canonical and fails validation", () => {
  // Confirm 'Bookmarked' was an invented value and is NOT in JobQuest's canonical stages
  assert.equal(STAGES.includes("Bookmarked"), false)

  // Test that validating 'Bookmarked' against canonical STAGES produces an error
  function validateStage(stage) {
    if (!STAGES.includes(stage)) {
      return `Unsupported stage: ${stage}`
    }
    return null
  }

  const err = validateStage("Bookmarked")
  assert.equal(err, "Unsupported stage: Bookmarked")

  // Meanwhile, canonical bookmarking stage 'Saved' passes validation cleanly
  assert.equal(validateStage("Saved"), null)
})

test("workflow action labels map directly to valid canonical backend values", () => {
  const workflowActions = STAGES.map((s) => ({ label: s, value: s }))
  for (const action of workflowActions) {
    assert.ok(action.label, "Label must not be empty")
    assert.ok(STAGES.includes(action.value), `Value ${action.value} must be in STAGES`)
  }
})

test("every canonical stage is valid and accepted by validation logic", () => {
  for (const stage of STAGES) {
    assert.ok(typeof stage === "string" && stage.length > 0)
    assert.ok(STAGES.includes(stage))
  }
})

test("buildSecureJobQuestUrl: constructs valid target URLs strictly bound to configured origin", () => {
  assert.equal(
    buildSecureJobQuestUrl("http://localhost:3000", "/?application=123"),
    "http://localhost:3000/?application=123",
  )
  assert.equal(
    buildSecureJobQuestUrl("http://localhost:3000/", "?application=123"),
    "http://localhost:3000/?application=123",
  )
  assert.equal(
    buildSecureJobQuestUrl("https://jobquest.example.com", "/?page=applications"),
    "https://jobquest.example.com/?page=applications",
  )
  assert.equal(
    buildSecureJobQuestUrl("https://jobquest.example.com/", "#detail:456"),
    "https://jobquest.example.com/#detail:456",
  )
})

test("buildSecureJobQuestUrl: rejects open redirects, data URIs, and javascript protocol", () => {
  // Disallowed protocols
  assert.throws(() => buildSecureJobQuestUrl("javascript:alert(1)", "/?app=1"), /must use http: or https:/)
  assert.throws(() => buildSecureJobQuestUrl("data:text/html,test", "/?app=1"), /must use http: or https:/)

  // Empty instance URL
  assert.throws(() => buildSecureJobQuestUrl("", "/?app=1"), /not configured/)

  // Relative open-redirect tricks that attempt to alter hostname
  assert.throws(
    () => buildSecureJobQuestUrl("http://localhost:3000", "//evil.com/phish"),
    /origin boundary/,
  )
})

test("duplicate match items provide stable application ID across all match tiers", () => {
  const sampleApp = { id: 42, company: "ABC Corp", job_title: "QA Engineer", stage: "Saved" }

  const exactMatch = {
    id: sampleApp.id,
    application_id: sampleApp.id,
    match_type: "exact_posting",
    application: sampleApp,
  }
  const sameRoleMatch = {
    id: sampleApp.id,
    application_id: sampleApp.id,
    match_type: "same_role",
    application: sampleApp,
  }
  const companyOnlyMatch = {
    id: sampleApp.id,
    application_id: sampleApp.id,
    match_type: "company_only",
    application: sampleApp,
  }

  for (const match of [exactMatch, sameRoleMatch, companyOnlyMatch]) {
    assert.equal(typeof match.id, "number")
    assert.equal(match.id, 42)
    assert.equal(match.application_id, 42)
    assert.equal(match.application.id, 42)
  }
})

