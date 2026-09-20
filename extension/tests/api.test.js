// JobQuest Capture Extension — API Client Unit Tests

import test from "node:test"
import assert from "node:assert/strict"
import { normalizeInstanceUrl } from "../api/jobquest.js"

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
