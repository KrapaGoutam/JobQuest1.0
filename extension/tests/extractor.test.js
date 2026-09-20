// JobQuest Capture Extension — Extractor Unit Tests

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { parseHTML } from "../../backend/node_modules/linkedom/esm/index.js"

import { extractJsonLd } from "../extractors/jsonld.js"
import { extractGreenhouse } from "../extractors/greenhouse.js"
import { extractLever } from "../extractors/lever.js"
import { extractIndeed } from "../extractors/indeed.js"
import { extractGeneric } from "../extractors/generic.js"
import { extractJobPosting } from "../extractors/index.js"

import { fileURLToPath } from "node:url"

function loadFixture(filename) {
  const filePath = fileURLToPath(new URL(`../fixtures/${filename}`, import.meta.url))
  const html = fs.readFileSync(filePath, "utf-8")
  const { document } = parseHTML(html)
  return document
}

test("JSON-LD extractor: accurately extracts structured schema.org JobPosting", () => {
  const doc = loadFixture("jsonld_job.html")
  const result = extractJsonLd(doc, "https://stripe.com/jobs/12345")

  assert.ok(result, "Result should not be null")
  assert.equal(result.jobTitle, "Staff Software Engineer")
  assert.equal(result.company, "Stripe")
  assert.equal(result.location, "South San Francisco, CA, US")
  assert.equal(result.workArrangement, "Remote")
  assert.equal(result.employmentType, "Full-time")
  assert.equal(result.salaryMin, 195000)
  assert.equal(result.salaryMax, 255000)
  assert.equal(result.salaryCurrency, "USD")
  assert.ok(result.salaryRange.includes("195,000"))
  assert.ok(result.description.includes("Stripe Billing"))
  assert.equal(result.confidence, "jsonld")
})

test("Greenhouse extractor: parses Greenhouse DOM selectors correctly", () => {
  const doc = loadFixture("greenhouse_job.html")
  const result = extractGreenhouse(
    doc,
    "https://boards.greenhouse.io/acmecorp/jobs/98765",
  )

  assert.ok(result, "Result should not be null")
  assert.equal(result.jobTitle, "Senior Frontend Engineer")
  assert.equal(result.company, "Acme Corporation")
  assert.equal(result.location, "San Francisco, CA (Hybrid)")
  assert.equal(result.workArrangement, "Hybrid")
  assert.ok(result.description.includes("build web applications"))
  assert.equal(result.source, "Greenhouse")
  assert.equal(result.confidence, "ats_greenhouse")
})

test("Lever extractor: parses Lever DOM selectors correctly", () => {
  const doc = loadFixture("lever_job.html")
  const result = extractLever(
    doc,
    "https://jobs.lever.co/globex/1111-2222-3333",
  )

  assert.ok(result, "Result should not be null")
  assert.equal(result.jobTitle, "Data Platform Engineer")
  assert.equal(result.company, "Globex Industries")
  assert.equal(result.location, "New York, NY")
  assert.equal(result.workArrangement, "Remote")
  assert.equal(result.employmentType, "Full-time")
  assert.ok(result.description.includes("streaming infrastructure"))
  assert.equal(result.source, "Lever")
  assert.equal(result.confidence, "ats_lever")
})

test("Generic extractor: handles non-job pages gracefully without fabricating data", () => {
  const doc = loadFixture("no_data_job.html")
  const result = extractGeneric(doc, "https://blog.example.com/posts/cloud-trends")

  assert.ok(result, "Result should not be null")
  assert.equal(result.salaryMin, null, "Salary must remain null when not present")
  assert.equal(result.salaryMax, null, "Salary must remain null when not present")
  assert.equal(result.salaryRange, "")
  assert.equal(result.workArrangement, "")
  assert.equal(result.confidence, "generic")
})

test("Orchestrator: cascades through priorities and returns clean capture object", () => {
  const jsonLdDoc = loadFixture("jsonld_job.html")
  const captured = extractJobPosting(
    jsonLdDoc,
    "https://stripe.com/jobs/12345?utm_source=linkedin",
  )

  assert.equal(captured.jobTitle, "Staff Software Engineer")
  assert.equal(captured.company, "Stripe")
  assert.equal(captured.workArrangement, "Remote")
  assert.equal(captured.confidence, "jsonld")
  assert.equal(
    captured.jobUrl,
    "https://stripe.com/jobs/12345?utm_source=linkedin",
  )
})
