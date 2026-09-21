# Extension Installation & Setup Guide — JobQuest Capture

This guide covers installing, configuring, and validating the **JobQuest Capture** Manifest V3 browser extension for Google Chrome and Microsoft Edge.

---

## 1. Installation (Load Unpacked)

JobQuest Capture is currently distributed for developer / local testing as an unpacked extension.

### Google Chrome
1. Open Google Chrome.
2. Navigate to [`chrome://extensions`](chrome://extensions).
3. In the top-right corner, switch the **Developer mode** toggle to **ON**.
4. Click the **Load unpacked** button in the top-left toolbar.
5. In the file picker, select the `extension/` directory inside this repository:
   ```text
   <path-to-jobquest>/extension
   ```
6. The **JobQuest Capture** card will appear with its blue briefcase icon.
7. Click the extension puzzle icon in the Chrome toolbar and click the **Pin** icon next to JobQuest Capture.

### Microsoft Edge
1. Open Microsoft Edge.
2. Navigate to [`edge://extensions`](edge://extensions).
3. In the left navigation sidebar, toggle **Developer mode** to **ON**.
4. Click **Load unpacked**.
5. Select the `extension/` directory.
6. Pin JobQuest Capture to your Edge address bar.

---

## 2. Configuration & Token Setup

Before capturing jobs, connect the extension to your local or hosted JobQuest instance.

### Step A: Generate an Extension Token
1. Open your JobQuest web workspace in the browser (e.g. `http://localhost:3000`).
2. Navigate to **Settings** &rarr; **Browser Extension**.
3. Under "Generate New Token", enter a descriptive label (e.g. `MacBook Pro Chrome` or `Work PC`).
4. Click **Generate Token**.
5. A green banner displays your 64-character token. Click **Copy Token** immediately (it is only shown once).

### Step B: Configure the Extension
1. Right-click the **JobQuest Capture** toolbar icon and choose **Options** (or click the gear icon in the popup).
2. Enter:
   - **JobQuest Instance URL**: `http://localhost:3000` (or your production URL, e.g. `https://jobquest.onrender.com`).
   - **Extension Access Token**: Paste your 64-character token.
3. Click **Test Connection**.
   - A success message will appear: `Connected successfully as <Your Name>`.
4. Click **Save Settings**.

---

## 3. Capturing Jobs

1. Navigate to any job posting page (e.g., LinkedIn, Greenhouse, Lever, Indeed, or an employer careers page).
2. Click the **JobQuest Capture** icon in your browser toolbar.
3. The popup opens, injects the extractor into the active tab, and pre-fills:
   - Company
   - Job Title
   - Location
   - Work Arrangement (Remote / Hybrid / Onsite)
   - Employment Type
   - Salary Range
   - Job URL & Source
4. Review and adjust any captured values as needed.

---

## 4. Duplicate Detection Workflow

The extension automatically checks your JobQuest history:

- **No existing applications**: No warning banner is shown. Click **Save Application** to save immediately.
- **`COMPANY_ONLY` (Informational)**:
  - If you previously applied to a *different* job at this company, an informational blue banner appears:
    `ℹ You already have another application at this company.`
  - It shows your previous role and current role.
  - Normal save is enabled without needing duplicate overrides.
- **`SAME_ROLE` / `EXACT_POSTING` (Duplicate Warning)**:
  - If an application already exists for this exact posting URL or the same role at this company, a warning banner appears.
  - You can choose:
    - **Open Existing**: Opens your existing application in JobQuest.
    - **Save Anyway**: Bypasses the warning and saves a new application.
    - **Cancel**: Closes the popup without saving.

---

## 5. Tailored Resume Modes

Under **Tailored Resume**, select your submission strategy:
- **Select existing**: Choose from resumes loaded directly from your JobQuest database. Transmits `resume_id` and `resume_version`.
- **Enter manually**: Enter a custom version label (e.g. `QA Automation v96`). Transmits `resume_version` without an invalid `resume_id`.
- **None**: For applications submitted without a tagged resume.

---

## 6. Troubleshooting

### Historical Defect: "resume_id must be a positive integer"
- **Status**: **FIXED in code**.
- **Root Cause**: Backend validation previously coerced `null` values into `0`, triggering `< 1` validation failure when no existing resume was selected or when entering manual text.
- **Resolution**: Backend validation now accepts `null` for `resume_id`, and the popup UI cleanly sends `null` when in manual or none mode.

### Authentication Failed
- Verify that your JobQuest backend server is running (`npm start` or Render instance).
- Verify that the instance URL does not have typos (ensure `http://` or `https://` is included).
- If your token was revoked in Settings, generate a new token and update it in Options.

### Extractor Doesn't Fill All Fields
- Many job boards do not publish salary or employment type in their metadata.
- Missing fields remain empty to ensure data accuracy—you can type or select them manually before clicking Save.
