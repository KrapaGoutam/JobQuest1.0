# Extension Security Posture — JobQuest Capture

## Security Architecture Overview

JobQuest Capture operates in an untrusted web environment, extracting data from third-party websites and communicating with the user's private JobQuest instance. Security is designed around principle-of-least-privilege, user-ownership scoping, and strict input sanitization.

---

## 1. Authentication & Bearer Tokens

### No Session Cookie Reuse
The JobQuest web application protects user sessions via `HttpOnly; SameSite=Strict` cookies. In Manifest V3 extensions, accessing these cookies across origins presents security risks and requires broad browser permissions (`cookies`).

Instead, the extension relies on **dedicated Bearer Tokens**:
- Generated explicitly in JobQuest Settings (`POST /api/extension/tokens`).
- Requires active web session and valid CSRF token to generate.
- Only a cryptographically secure SHA-256 hash (`token_hash`) is stored in the database (`extension_tokens` table).
- Raw token is displayed once in the UI and never stored in server plaintext.
- Revocable at any moment by the user from Settings.
- Revoked tokens are immediately rejected with HTTP 401.

### Client-Side Token Storage
- Stored exclusively in `chrome.storage.local`.
- Never written to `chrome.storage.sync` (prevents cloud sync leakage).
- Never exposed in console logs or error messages.

---

## 2. Multi-Tenant User Scoping & IDOR Prevention

Every extension API endpoint enforces strict authenticated user scoping:

```sql
SELECT ... FROM applications WHERE user_id = ? ...
SELECT ... FROM resumes WHERE user_id = ? AND is_archived = 0 ...
INSERT INTO applications (user_id, created_by, updated_by, ...) VALUES (?, ?, ?, ...)
```

- **Duplicate Check Isolation**:
  Duplicate checks only query applications where `user_id = actor.user_id`. A user can never discover or infer another user's job search history, companies, roles, or URLs.
- **Resume Ownership**:
  `createApplication` validates that `resume_id` belongs to `actor.user_id`. Attempting to associate an application with an unowned resume yields `"Resume does not belong to the application owner"`.

---

## 3. SQL Injection Prevention

All database interactions across `backend/src/extension.js` and `backend/src/service.js` use strictly parameterized queries (`?` placeholders with SQLite / PostgreSQL parameter arrays). No user-controlled strings (company name, role, URL, notes, resume version) are ever interpolated into SQL statement templates.

---

## 4. Input Sanitization & Untrusted Content

### Web Page Extraction
- Content scripts extract text via standard DOM text properties (`textContent`, `innerText`).
- No raw HTML or executable scripts are preserved.
- Page content is treated as untrusted user input.
- Long descriptions are handled safely without script execution.

### Safe URL Protocols
- The `job_url` field is validated by `validateApplication()` in `backend/src/service.js`.
- Only `http:` and `https:` protocols are accepted.
- Dangerous pseudo-protocols (`javascript:`, `data:`, `vbscript:`) are rejected with HTTP 400.

### Manual Tailored Resume Sanitization
- Manual resume versions entered in the extension are treated as untrusted text.
- Validated on both client and server:
  - Max length: 100 characters.
  - Allowed characters: unicode letters, numbers, spaces, hyphens, underscores, periods, and parentheses (`/^[\p{L}\p{N} ._()\-]+$/u`).
- HTML entities are escaped before display in popup summaries.

---

## 5. Network & Failure State Isolation

Network errors, API 500s, or authorization rejections must never leak or be misclassified:
- A failed duplicate check (HTTP 401, 403, 500, network offline) explicitly yields `CHECK_ERROR`.
- The extension never shows an error state as `"Existing application found"`.
- Error messages avoid leaking internal stack traces or database connection strings.

---

## 6. Manifest V3 Permission Audit

The extension requests only minimal required permissions in `extension/manifest.json`:
- `activeTab`: Grants access to extract from the current active tab only when the user clicks the extension action icon.
- `scripting`: Executes `content.js` inside the active tab.
- `storage`: Persists instance URL and bearer token in `chrome.storage.local`.
- No broad background network listeners, webRequest interceptors, or persistent host permissions are used.
