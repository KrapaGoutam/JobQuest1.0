// JobQuest Capture Extension — Popup Controller

import {
  getSettings,
  testConnection,
  getActiveResumes,
  checkDuplicate,
  createApplication,
} from "./api/jobquest.js"

// DOM Elements
const screenLoading = document.getElementById("screen-loading")
const screenUnconfigured = document.getElementById("screen-unconfigured")
const screenCapture = document.getElementById("screen-capture")
const screenSuccess = document.getElementById("screen-success")

const unconfiguredTitle = document.getElementById("unconfigured-title")
const unconfiguredDesc = document.getElementById("unconfigured-desc")
const openSettingsBtn = document.getElementById("open-settings-btn")
const optionsBtn = document.getElementById("options-btn")

const dupBanner = document.getElementById("dup-banner")
const dupHeading = document.getElementById("dup-heading")
const dupMessage = document.getElementById("dup-message")

const form = document.getElementById("capture-form")
const inputCompany = document.getElementById("input-company")
const inputTitle = document.getElementById("input-title")
const inputLocation = document.getElementById("input-location")
const inputArrangement = document.getElementById("input-arrangement")
const inputEmployment = document.getElementById("input-employment")
const inputSalary = document.getElementById("input-salary")
const inputResume = document.getElementById("input-resume")
const inputStage = document.getElementById("input-stage")
const inputDate = document.getElementById("input-date")
const inputUrl = document.getElementById("input-url")
const inputSource = document.getElementById("input-source")
const inputNotes = document.getElementById("input-notes")
const formError = document.getElementById("form-error")
const saveBtn = document.getElementById("save-btn")

const successSummary = document.getElementById("success-summary")
const viewAppBtn = document.getElementById("view-app-btn")
const captureAnotherBtn = document.getElementById("capture-another-btn")

let currentSettings = { instanceUrl: "", apiToken: "" }
let lastCreatedAppId = null

function showScreen(screen) {
  screenLoading.hidden = true
  screenUnconfigured.hidden = true
  screenCapture.hidden = true
  screenSuccess.hidden = true
  screen.hidden = false
}

function escapeHtml(str) {
  const div = document.createElement("div")
  div.textContent = str || ""
  return div.innerHTML
}

async function runDuplicateCheck() {
  const job_url = inputUrl.value.trim()
  const company = inputCompany.value.trim()
  const job_title = inputTitle.value.trim()

  if (!job_url && (!company || !job_title)) {
    dupBanner.hidden = true
    return
  }

  try {
    const check = await checkDuplicate(
      currentSettings.instanceUrl,
      currentSettings.apiToken,
      { job_url, company, job_title },
    )

    if (check.has_duplicate && check.matches.length > 0) {
      const match = check.matches[0]
      dupBanner.hidden = false
      if (match.level === 1) {
        dupBanner.className = "banner danger"
        dupHeading.textContent = "Already saved in JobQuest"
        dupMessage.innerHTML = `You saved this exact posting on <strong>${escapeHtml(match.application.date_applied)}</strong> (Stage: <strong>${escapeHtml(match.application.stage)}</strong>).`
      } else {
        dupBanner.className = "banner warning"
        dupHeading.textContent = "Possible duplicate found"
        dupMessage.innerHTML = `Found an existing application for <strong>${escapeHtml(match.application.company)}</strong> — <em>${escapeHtml(match.application.job_title)}</em> (Stage: ${escapeHtml(match.application.stage)}).`
      }
    } else {
      dupBanner.hidden = true
    }
  } catch (err) {
    console.warn("Duplicate check failed:", err)
    dupBanner.hidden = true
  }
}

async function loadActiveResumes() {
  try {
    const resumes = await getActiveResumes(
      currentSettings.instanceUrl,
      currentSettings.apiToken,
    )
    inputResume.innerHTML = '<option value="">None selected</option>'
    for (const r of resumes) {
      const opt = document.createElement("option")
      opt.value = r.id
      opt.dataset.version = r.version_name
      opt.textContent = `${r.version_name}${r.target_role ? ` (${r.target_role})` : ""}`
      inputResume.appendChild(opt)
    }
  } catch (err) {
    console.warn("Failed to load resumes:", err)
  }
}

async function init() {
  showScreen(screenLoading)

  try {
    currentSettings = await getSettings()
    if (!currentSettings.instanceUrl || !currentSettings.apiToken) {
      unconfiguredTitle.textContent = "Setup Required"
      unconfiguredDesc.textContent =
        "Connect JobQuest Capture to your personal JobQuest instance using an access token."
      showScreen(screenUnconfigured)
      return
    }

    // Verify token with backend
    try {
      await testConnection(currentSettings.instanceUrl, currentSettings.apiToken)
    } catch (authErr) {
      unconfiguredTitle.textContent = "Authentication Failed"
      unconfiguredDesc.textContent = `Could not authenticate with JobQuest: ${authErr.message}. Please check your instance URL and token in Settings.`
      showScreen(screenUnconfigured)
      return
    }

    // Auth succeeded: fetch active resumes in background
    loadActiveResumes()

    // Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    let captured = null

    if (tab && tab.id) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        })
        captured = results[0]?.result
      } catch (scriptErr) {
        console.warn("Could not inject content script:", scriptErr)
      }
    }

    // Populate form fields
    const today = new Date().toISOString().slice(0, 10)
    inputDate.value = today

    if (captured) {
      inputCompany.value = captured.company || ""
      inputTitle.value = captured.jobTitle || ""
      inputLocation.value = captured.location || ""
      if (captured.workArrangement) inputArrangement.value = captured.workArrangement
      if (captured.employmentType) inputEmployment.value = captured.employmentType
      inputSalary.value = captured.salaryRange || ""
      inputUrl.value = captured.jobUrl || tab?.url || ""
      inputSource.value = captured.source || ""
    } else {
      inputUrl.value = tab?.url || ""
      try {
        if (tab?.url) inputSource.value = new URL(tab.url).hostname.replace(/^www\./, "")
      } catch {}
    }

    showScreen(screenCapture)

    // Run duplicate check on initial values
    runDuplicateCheck()
  } catch (err) {
    unconfiguredTitle.textContent = "Initialization Error"
    unconfiguredDesc.textContent = err.message
    showScreen(screenUnconfigured)
  }
}

async function handleSave(event) {
  event.preventDefault()
  formError.hidden = true
  formError.textContent = ""

  const company = inputCompany.value.trim()
  const jobTitle = inputTitle.value.trim()

  if (!company || !jobTitle) {
    formError.hidden = false
    formError.textContent = "Company and Job Title are required."
    return
  }

  const selectedOpt = inputResume.selectedOptions[0]
  const resumeId = inputResume.value ? Number(inputResume.value) : null
  const resumeVersion = selectedOpt && selectedOpt.value ? selectedOpt.dataset.version : null

  const payload = {
    company,
    job_title: jobTitle,
    location: inputLocation.value.trim() || null,
    work_arrangement: inputArrangement.value || null,
    employment_type: inputEmployment.value || null,
    salary_range: inputSalary.value.trim() || null,
    stage: inputStage.value || "Applied",
    date_applied: inputDate.value,
    job_url: inputUrl.value.trim() || null,
    source: inputSource.value.trim() || null,
    notes: inputNotes.value.trim() || null,
    resume_id: resumeId,
    resume_version: resumeVersion,
  }

  saveBtn.disabled = true
  saveBtn.textContent = "Saving to JobQuest..."

  try {
    const res = await createApplication(
      currentSettings.instanceUrl,
      currentSettings.apiToken,
      payload,
    )
    lastCreatedAppId = res.id
    successSummary.innerHTML = `Saved <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(company)}</strong>.`
    showScreen(screenSuccess)
  } catch (err) {
    formError.hidden = false
    formError.textContent = err.message || "Failed to save application"
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = "Save Application"
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init()

  optionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage())
  openSettingsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage())

  form.addEventListener("submit", handleSave)

  inputCompany.addEventListener("change", runDuplicateCheck)
  inputTitle.addEventListener("change", runDuplicateCheck)
  inputUrl.addEventListener("change", runDuplicateCheck)

  viewAppBtn.addEventListener("click", () => {
    const base = currentSettings.instanceUrl.replace(/\/+$/, "")
    chrome.tabs.create({ url: `${base}/` })
  })

  captureAnotherBtn.addEventListener("click", () => {
    init()
  })
})
