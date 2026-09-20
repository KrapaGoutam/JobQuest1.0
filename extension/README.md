# JobQuest Capture Extension

Manifest V3 browser extension for Google Chrome and Microsoft Edge that captures job postings from the web with one click and saves them directly into your private JobQuest workspace.

---

## Features

- **Multi-Tier Smart Extractor**:
  1. **schema.org `JobPosting` JSON-LD**: High-fidelity structured metadata (title, company, address, telecommute, salary ranges).
  2. **Site-Specific ATS Adapters**: Built-in support for Greenhouse (`greenhouse.io`), Lever (`jobs.lever.co`), and Indeed (`indeed.com`).
  3. **Page Meta Tags**: OpenGraph, Twitter Cards, and canonical `<title>` parsing.
  4. **DOM Heuristics**: Automatic extraction of headings and page metadata without fabricating missing data.
- **Two-Level Duplicate Detection**:
  - **Level 1 (Exact URL)**: Normalizes URLs (strips tracking parameters like `utm_*` and trailing slashes) to detect identical postings you previously saved.
  - **Level 2 (Company + Job Title)**: Case-insensitive, whitespace-normalized matching across your active applications.
- **Resume Tailoring Support**: Dynamically loads your active resume versions from JobQuest so you can explicitly tag which resume version you used.
- **Secure Bearer Token Auth**: Connects using scoped extension tokens (stored as SHA-256 hashes, revocable at any time from JobQuest Settings).

---

## Installation (Load Unpacked)

1. Open your browser's extension management page:
   - Chrome: [`chrome://extensions`](chrome://extensions)
   - Edge: [`edge://extensions`](edge://extensions)
2. Enable **Developer mode** (toggle in the top-right corner of the page).
3. Click **Load unpacked**.
4. Select the `extension/` folder in this repository.
5. The **JobQuest Capture** icon will appear in your extension toolbar. Pin it for quick access.

---

## Configuration

1. Log in to your JobQuest workspace (e.g. `http://localhost:3000` or your hosted domain).
2. Go to **Settings** &rarr; **Browser Extension**.
3. Enter a label for your browser (e.g., "Work Laptop") and click **Generate Token**.
4. Copy the generated token immediately (it is only displayed once).
5. Click the JobQuest extension icon in your browser toolbar, or right-click the icon and choose **Options**.
6. Enter:
   - **JobQuest Instance URL**: `http://localhost:3000` (or your deployed URL)
   - **Extension Access Token**: Paste the 64-character token you copied
7. Click **Test Connection** to verify your account connection.
8. Click **Save Settings**.

---

## Usage

1. Navigate to any job posting page (e.g. on LinkedIn, Greenhouse, Lever, Indeed, or a company career site).
2. Click the **JobQuest Capture** toolbar icon.
3. The extension extracts the job title, company, location, work arrangement, salary, and board source automatically.
4. Review or adjust any captured field.
5. Check for any duplicate warnings (the extension flags postings already in your database).
6. Optionally select which **Tailored Resume** you submitted.
7. Click **Save Application**.
8. Click **Open in JobQuest** to view your application in your workspace table or Kanban board.

---

## Development & Testing

All extension tests are integrated into the main JobQuest test runner.

### Syntax and Linting
```bash
# From the backend directory:
npm run lint
npm run typecheck
```

### Extractor Unit Tests
```bash
# Runs extractor unit tests on fixtures and API client tests:
npm run test:extension
```

### Playwright E2E Tests
```bash
# Runs full browser capture and token management E2E tests:
npx playwright test e2e/extension.spec.js
```
