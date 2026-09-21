// JobQuest Capture Extension — Popup Controller

import {
  getSettings,
  testConnection,
  getActiveResumes,
  getStages,
  buildSecureJobQuestUrl,
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
const dupIcon = document.getElementById("dup-icon")
const dupHeading = document.getElementById("dup-heading")
const dupMessage = document.getElementById("dup-message")
const dupActions = document.getElementById("dup-actions")
const dupOpenBtn = document.getElementById("dup-open-btn")
const dupSaveAnywayBtn = document.getElementById("dup-save-anyway-btn")
const dupCancelBtn = document.getElementById("dup-cancel-btn")

const form = document.getElementById("capture-form")
const inputCompany = document.getElementById("input-company")
const inputTitle = document.getElementById("input-title")
const inputLocation = document.getElementById("input-location")
const inputArrangement = document.getElementById("input-arrangement")
const inputEmployment = document.getElementById("input-employment")
const inputSalary = document.getElementById("input-salary")

// Resume elements
const modeResumeExisting = document.getElementById("mode-resume-existing")
const modeResumeManual = document.getElementById("mode-resume-manual")
const modeResumeNone = document.getElementById("mode-resume-none")
const groupResumeExisting = document.getElementById("group-resume-existing")
const groupResumeManual = document.getElementById("group-resume-manual")
const inputResume = document.getElementById("input-resume")
const inputResumeManual = document.getElementById("input-resume-manual")

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
let activeResumeMode = "existing"
let currentDuplicateMatch = null
let bypassDuplicateWarning = false

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

function clearDuplicateBanner() {
  dupBanner.hidden = true
  dupHeading.textContent = ""
  dupMessage.innerHTML = ""
  dupActions.hidden = true
  dupOpenBtn.hidden = true
  dupSaveAnywayBtn.hidden = true
  dupCancelBtn.hidden = true
  currentDuplicateMatch = null
}

function switchResumeMode(mode) {
  activeResumeMode = mode
  if (mode === "existing") {
    groupResumeExisting.hidden = false
    groupResumeManual.hidden = true
    inputResumeManual.value = "" // clear stale manual value
  } else if (mode === "manual") {
    groupResumeExisting.hidden = true
    groupResumeManual.hidden = false
    inputResume.value = "" // clear stale selected value
  } else {
    groupResumeExisting.hidden = true
    groupResumeManual.hidden = true
    inputResume.value = ""
    inputResumeManual.value = ""
  }
}

async function runDuplicateCheck() {
  if (bypassDuplicateWarning) return

  const job_url = inputUrl.value.trim()
  const company = inputCompany.value.trim()
  const job_title = inputTitle.value.trim()

  if (!job_url && (!company || !job_title)) {
    clearDuplicateBanner()
    return
  }

  try {
    const check = await checkDuplicate(
      currentSettings.instanceUrl,
      currentSettings.apiToken,
      { job_url, company, job_title },
    )

    const matchType = check.match_type || (check.matches && check.matches[0]?.match_type) || "none"

    if (matchType === "exact_posting" && check.matches && check.matches.length > 0) {
      const match = check.matches[0]
      currentDuplicateMatch = match
      dupBanner.hidden = false
      dupBanner.className = "banner danger"
      dupIcon.textContent = "⚠"
      dupHeading.textContent = "This job posting is already in JobQuest."
      const dateText = match.application.date_applied ? ` on <strong>${escapeHtml(match.application.date_applied)}</strong>` : ""
      const stageText = match.application.stage ? ` (Stage: <strong>${escapeHtml(match.application.stage)}</strong>)` : ""
      dupMessage.innerHTML = `You already saved this posting${dateText}${stageText}.`

      dupActions.hidden = false
      dupOpenBtn.hidden = false
      dupOpenBtn.textContent = "Open Existing"
      dupSaveAnywayBtn.hidden = false
      dupCancelBtn.hidden = false
    } else if (matchType === "same_role" && check.matches && check.matches.length > 0) {
      const match = check.matches[0]
      currentDuplicateMatch = match
      dupBanner.hidden = false
      dupBanner.className = "banner warning"
      dupIcon.textContent = "⚠"
      dupHeading.textContent = "An application already exists for this role at this company."
      const stageText = match.application.stage ? ` (Stage: ${escapeHtml(match.application.stage)})` : ""
      dupMessage.innerHTML = `Found an existing application for <strong>${escapeHtml(match.application.company)}</strong> — <em>${escapeHtml(match.application.job_title)}</em>${stageText}.`

      dupActions.hidden = false
      dupOpenBtn.hidden = false
      dupOpenBtn.textContent = "Open Existing"
      dupSaveAnywayBtn.hidden = false
      dupCancelBtn.hidden = false
    } else if (matchType === "company_only" && check.matches && check.matches.length > 0) {
      const match = check.matches[0]
      currentDuplicateMatch = match
      dupBanner.hidden = false
      dupBanner.className = "banner info"
      dupIcon.textContent = "ℹ"
      dupHeading.textContent = "You already have another application at this company."
      const currentRole = job_title || "New Role"
      dupMessage.innerHTML = `Existing role: <strong>${escapeHtml(match.application.job_title)}</strong> (Stage: ${escapeHtml(match.application.stage)}).<br>Current role: <strong>${escapeHtml(currentRole)}</strong>.`

      dupActions.hidden = false
      dupOpenBtn.hidden = false
      dupOpenBtn.textContent = "View Existing Application"
      dupSaveAnywayBtn.hidden = true // Not needed; normal save is available without override
      dupCancelBtn.hidden = true
    } else {
      clearDuplicateBanner()
    }
  } catch (err) {
    console.warn("Duplicate check failed:", err)
    // Never show "Existing application found" on error
    dupBanner.hidden = false
    dupBanner.className = "banner warning"
    dupIcon.textContent = "ℹ"
    dupHeading.textContent = "Could not check JobQuest for existing applications."
    dupMessage.textContent = "JobQuest could not be reached to verify existing applications. You can still save this job."
    dupActions.hidden = true
    dupOpenBtn.hidden = true
    dupSaveAnywayBtn.hidden = true
    dupCancelBtn.hidden = true
    currentDuplicateMatch = null
  }
}

async function loadWorkflowStages() {
  try {
    const data = await getStages(
      currentSettings.instanceUrl,
      currentSettings.apiToken,
    )
    const actions =
      data.workflow_actions ||
      (data.stages || []).map((s) => ({ label: s, value: s }))
    const defaultStage = data.default || "Applied"

    inputStage.innerHTML = ""
    for (const item of actions) {
      const opt = document.createElement("option")
      opt.value = item.value
      opt.textContent = item.label
      if (item.value === defaultStage) {
        opt.selected = true
      }
      inputStage.appendChild(opt)
    }
    saveBtn.disabled = false
  } catch (err) {
    console.warn("Failed to load canonical workflow stages:", err)
    formError.hidden = false
    formError.textContent = `Could not load canonical JobQuest stages: ${err.message}. Saving is disabled until connected.`
    saveBtn.disabled = true
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
  bypassDuplicateWarning = false
  currentDuplicateMatch = null
  clearDuplicateBanner()
  formError.hidden = true
  formError.textContent = ""

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

    // Auth succeeded: fetch canonical workflow stages and active resumes
    await loadWorkflowStages()
    loadActiveResumes()

    // Reset resume mode to existing by default
    modeResumeExisting.checked = true
    switchResumeMode("existing")

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
  if (event) event.preventDefault()
  formError.hidden = true
  formError.textContent = ""

  const company = inputCompany.value.trim()
  const jobTitle = inputTitle.value.trim()

  if (!company || !jobTitle) {
    formError.hidden = false
    formError.textContent = "Company and Job Title are required."
    return
  }

  // Check duplicate override for blocking duplicate states
  if (
    !bypassDuplicateWarning &&
    currentDuplicateMatch &&
    (currentDuplicateMatch.match_type === "exact_posting" || currentDuplicateMatch.match_type === "same_role")
  ) {
    formError.hidden = false
    formError.textContent = "An existing application was found. Click 'Save Anyway' to save this application."
    return
  }

  // Handle Tailored Resume mode values
  let resumeId = null
  let resumeVersion = null

  if (activeResumeMode === "existing") {
    const selectedOpt = inputResume.selectedOptions[0]
    resumeId = inputResume.value ? Number(inputResume.value) : null
    resumeVersion = selectedOpt && selectedOpt.value ? selectedOpt.dataset.version : null
  } else if (activeResumeMode === "manual") {
    const manualVal = inputResumeManual.value.trim()
    if (manualVal) {
      if (manualVal.length > 100) {
        formError.hidden = false
        formError.textContent = "Resume Version must be 100 characters or fewer."
        return
      }
      if (!/^[\p{L}\p{N} ._()\-]+$/u.test(manualVal)) {
        formError.hidden = false
        formError.textContent = "Resume Version may contain letters, numbers, spaces, hyphens, underscores, periods, and parentheses."
        return
      }
      resumeVersion = manualVal
    }
    resumeId = null
  } else {
    // None selected
    resumeId = null
    resumeVersion = null
  }

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

  // Resume mode switcher listeners
  modeResumeExisting.addEventListener("change", () => switchResumeMode("existing"))
  modeResumeManual.addEventListener("change", () => switchResumeMode("manual"))
  modeResumeNone.addEventListener("change", () => switchResumeMode("none"))

  // Reset duplicate override if fields change
  const onFieldChange = () => {
    bypassDuplicateWarning = false
    runDuplicateCheck()
  }

  inputCompany.addEventListener("change", onFieldChange)
  inputTitle.addEventListener("change", onFieldChange)
  inputUrl.addEventListener("change", onFieldChange)

  // Duplicate action buttons
  dupOpenBtn.addEventListener("click", () => {
    const targetId =
      currentDuplicateMatch?.application?.id ||
      currentDuplicateMatch?.id ||
      currentDuplicateMatch?.application_id
    if (targetId) {
      try {
        const targetUrl = buildSecureJobQuestUrl(
          currentSettings.instanceUrl,
          `/?application=${encodeURIComponent(targetId)}`,
        )
        chrome.tabs.create({ url: targetUrl })
        return
      } catch (err) {
        console.error("Failed to construct secure deep-link URL:", err)
      }
    }
    // Fallback to Applications page if target ID is not available
    try {
      const fallbackUrl = buildSecureJobQuestUrl(
        currentSettings.instanceUrl,
        "/?page=applications",
      )
      chrome.tabs.create({ url: fallbackUrl })
    } catch {
      const base = currentSettings.instanceUrl.replace(/\/+$/, "")
      chrome.tabs.create({ url: `${base}/` })
    }
  })

  dupSaveAnywayBtn.addEventListener("click", () => {
    bypassDuplicateWarning = true
    dupBanner.hidden = true
    handleSave()
  })

  dupCancelBtn.addEventListener("click", () => {
    window.close()
  })

  viewAppBtn.addEventListener("click", () => {
    if (lastCreatedAppId) {
      try {
        const targetUrl = buildSecureJobQuestUrl(
          currentSettings.instanceUrl,
          `/?application=${encodeURIComponent(lastCreatedAppId)}`,
        )
        chrome.tabs.create({ url: targetUrl })
        return
      } catch (err) {
        console.error("Failed to construct secure deep-link URL:", err)
      }
    }
    const base = currentSettings.instanceUrl.replace(/\/+$/, "")
    chrome.tabs.create({ url: `${base}/` })
  })

  captureAnotherBtn.addEventListener("click", () => {
    init()
  })
})
