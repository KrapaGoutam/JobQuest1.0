// JobQuest Capture Extension — Options Controller

import { getSettings, setSettings, testConnection, normalizeInstanceUrl } from "./api/jobquest.js"

const form = document.getElementById("options-form")
const instanceUrlInput = document.getElementById("instance-url")
const apiTokenInput = document.getElementById("api-token")
const testBtn = document.getElementById("test-btn")
const saveBtn = document.getElementById("save-btn")
const statusBox = document.getElementById("status-box")

function showStatus(type, message) {
  statusBox.className = `status-box show ${type}`
  statusBox.innerHTML = message
}

function clearStatus() {
  statusBox.className = "status-box"
  statusBox.textContent = ""
}

async function loadSettings() {
  try {
    const settings = await getSettings()
    if (settings.instanceUrl) {
      instanceUrlInput.value = settings.instanceUrl
    }
    if (settings.apiToken) {
      apiTokenInput.value = settings.apiToken
    }
  } catch (err) {
    console.error("Failed to load settings:", err)
  }
}

async function handleTestConnection() {
  const url = normalizeInstanceUrl(instanceUrlInput.value)
  const token = apiTokenInput.value.trim()

  if (!url) {
    showStatus("error", "Please enter a JobQuest instance URL.")
    instanceUrlInput.focus()
    return
  }

  if (!token) {
    showStatus("error", "Please enter your extension access token.")
    apiTokenInput.focus()
    return
  }

  testBtn.disabled = true
  showStatus("info", "Connecting to JobQuest workspace...")

  try {
    const user = await testConnection(url, token)
    showStatus(
      "success",
      `✓ Connected successfully! Authenticated as <strong>${escapeHtml(user.full_name || user.username)}</strong> (@${escapeHtml(user.username)}).`,
    )
  } catch (err) {
    showStatus(
      "error",
      `✗ Connection failed: ${escapeHtml(err.message || "Unable to reach JobQuest instance")}`,
    )
  } finally {
    testBtn.disabled = false
  }
}

async function handleSave(event) {
  event.preventDefault()
  const url = normalizeInstanceUrl(instanceUrlInput.value)
  const token = apiTokenInput.value.trim()

  if (!url) {
    showStatus("error", "Please enter a JobQuest instance URL.")
    instanceUrlInput.focus()
    return
  }

  if (!token) {
    showStatus("error", "Please enter your extension access token.")
    apiTokenInput.focus()
    return
  }

  saveBtn.disabled = true

  try {
    await setSettings({ instanceUrl: url, apiToken: token })
    showStatus("success", "✓ Settings saved successfully.")
  } catch (err) {
    showStatus("error", `Failed to save settings: ${escapeHtml(err.message)}`)
  } finally {
    saveBtn.disabled = false
  }
}

function escapeHtml(str) {
  const div = document.createElement("div")
  div.textContent = str || ""
  return div.innerHTML
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings()
  form.addEventListener("submit", handleSave)
  testBtn.addEventListener("click", handleTestConnection)
  instanceUrlInput.addEventListener("input", clearStatus)
  apiTokenInput.addEventListener("input", clearStatus)
})
