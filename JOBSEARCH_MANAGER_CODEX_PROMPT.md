# CODEX MASTER PROMPT

# Convert the Existing Project into a JobSearch Manager and Job Application Tracker

## ROLE

You are a senior full-stack engineer working directly inside an existing project repository.

Your task is to inspect the complete current project and transform it into a secure, working, multi-user **JobSearch Manager and Job Application Tracker**.

Modify the existing project in place.

Do not create an unrelated replacement application, parallel backend, duplicate frontend, second authentication system, or separate database unless the existing architecture already requires multiple services.

Use and preserve the current project's:

* Programming languages
* Frameworks
* Folder structure
* Database
* ORM
* Migration system
* Authentication system
* User model
* Role model
* UI components
* Styling system
* Testing tools
* Build system
* Environment-variable conventions
* Existing deployment or CI configuration, when present

Do not assume a specific technology stack before inspecting the repository.

Do not wait for confirmation after inspection. Make the smallest safe architectural decisions, document them, and proceed.

---

# 1. PRIMARY OBJECTIVE

Convert the current project's business use case into a JobSearch Manager where users manually record and track jobs they have already applied to.

Users must be able to enter application information through:

1. An individual job-application form
2. Bulk JSON input
3. Bulk structured-text input

The completed system must support:

* User registration and login
* Regular-user and manager roles
* Strict user-data ownership
* Job application tracking
* Application-stage tracking
* Application activity history
* Interview tracking
* Rejection tracking
* Follow-up tracking
* Professional connection and networking tracking
* Daily goals
* Weekly goals
* User dashboards
* Manager dashboards
* Manager access to users and all job-search records
* Bulk-import preview, validation, and import history

The system must not:

* Search job boards
* Scrape job websites
* Automatically discover jobs
* Automatically apply to jobs
* Automatically submit resumes
* Require a live job-search provider
* Import live postings from LinkedIn, Indeed, Jobright, or similar services
* Pretend manually entered records came from an external source

This is a manual job-application management and tracking system.

---

# 2. INSPECT THE EXISTING PROJECT FIRST

Before making changes, inspect the complete project.

Determine:

* Project root
* Current application purpose
* Backend framework
* Frontend framework
* Database technology
* ORM or database client
* Migration system
* Authentication implementation
* Login flow
* Registration flow
* Password or PIN hashing
* Session, cookie, token, or JWT handling
* Failed-login and lockout behavior
* User model
* Role model
* Manager authorization
* Existing API routes
* Existing pages
* Existing navigation
* Existing models
* Existing migrations
* Existing seed scripts
* Existing tests
* Existing test-database configuration
* Existing build commands
* Existing lint commands
* Existing type-check commands
* Existing unit-test commands
* Existing integration-test commands
* Existing end-to-end-test commands
* Existing environment variables
* Existing Git configuration
* Existing CI/CD configuration
* Existing remote repository configuration

Search the codebase for terms such as:

* Attendance
* Timesheet
* Clock in
* Clock out
* Employee
* User
* Manager
* Single user
* First profile
* Registration disabled
* Job
* Application
* Interview
* Follow-up
* Rejection
* Networking
* Goal
* Owner
* User ID
* Role
* Dashboard

Do not assume the existing project is still an attendance application.

If job-search functionality already exists, preserve working parts and extend them instead of deleting them unnecessarily.

---

# 3. GIT REPOSITORY SETUP

Inspect whether the project is already under Git version control.

## When Git Already Exists

If a `.git` directory exists:

* Do not reinitialize Git.
* Preserve the current repository history.
* Inspect the current branch.
* Inspect configured remotes.
* Run `git status`.
* Preserve all uncommitted user work.
* Do not reset, discard, or overwrite unrelated changes.
* Do not force-push.
* Do not rewrite history.
* Do not delete branches.
* Do not merge unrelated branches.

Use the existing development branch if one is clearly established.

If the current branch is a protected or main branch and repository conventions support feature branches, create a dedicated branch such as:

```text
feature/jobsearch-manager
```

Do not create a branch when doing so would conflict with explicit repository instructions.

## When Git Does Not Exist

If no Git repository exists:

1. Initialize Git in the project root.
2. Create or update an appropriate `.gitignore`.
3. Ensure secrets, environment files, databases, dependencies, generated files, build artifacts, coverage output, and editor files are ignored.
4. Create an initial baseline commit before changing the use case.
5. Create and switch to a `development` branch.
6. Perform the transformation on the `development` branch.

Suggested commands:

```bash
git init
git add .
git commit -m "chore: capture existing project baseline"
git branch -M development
```

Adjust commands for the operating system and repository state.

Do not commit:

* Real `.env` files
* API keys
* Passwords
* PINs
* Database credentials
* Tokens
* Local database files unless intentionally versioned
* Dependency folders
* Build output
* Test artifacts
* Browser recordings
* Generated secrets

## Remote Repository

If no remote exists:

* Do not invent a remote URL.
* Do not claim the project has been pushed.
* Prepare the repository so it can be pushed later.
* Document the exact command the user must run after creating a remote.

If a valid remote already exists and authentication is available, do not push unless the task explicitly authorizes pushing.

---

# 4. STAGED GIT COMMITS

Use Git throughout the transformation.

Create focused commits after meaningful, working stages.

Do not create one enormous commit unless repository constraints prevent staged commits.

Recommended commit stages:

```text
chore: capture existing project baseline
chore: add jobsearch data model and migrations
feat: add application ownership and authorization
feat: add job application management
feat: add bulk application import
feat: add interview and rejection tracking
feat: add follow-up and networking tracking
feat: add daily and weekly goals
feat: add user and manager dashboards
test: add jobsearch manager test coverage
ci: add automated quality checks
docs: update jobsearch manager documentation
```

Before each commit:

* Review `git diff`.
* Ensure no secret is included.
* Run the checks relevant to that stage.
* Commit only related changes.
* Use descriptive commit messages.

Do not commit broken intermediate code unless it is unavoidable and clearly documented.

At the end, provide the commit list and final Git status.

---

# 5. CI/CD CONFIGURATION

Inspect whether a CI/CD system already exists.

Examples include:

* GitHub Actions
* GitLab CI
* Bitbucket Pipelines
* Azure Pipelines
* Jenkins
* CircleCI
* Another repository-specific system

## Existing CI/CD

When CI/CD already exists:

* Preserve the existing provider.
* Update the existing workflow instead of adding a competing provider.
* Add the new database migration, backend, frontend, test, lint, type-check, and build steps.
* Preserve current secret names and environment conventions.
* Do not remove functioning workflows without a documented reason.

## No Existing CI/CD

When no CI/CD configuration exists:

* Add a GitHub Actions workflow under `.github/workflows/ci.yml`.
* Do not assume a GitHub remote already exists.
* Document that the workflow will run after the repository is pushed to GitHub.
* Do not invent repository secrets or deployment credentials.

The CI workflow should run on:

```yaml
push:
  branches:
    - development
    - main
    - master

pull_request:
  branches:
    - development
    - main
    - master

workflow_dispatch:
```

Adapt branch names to the repository.

The CI workflow should include only commands supported by the actual project.

Possible CI stages:

1. Repository checkout
2. Runtime setup
3. Dependency installation
4. Environment or configuration validation
5. Database client or ORM generation
6. Database migration verification
7. Backend lint
8. Backend type checking
9. Backend unit and integration tests
10. Frontend lint
11. Frontend type checking
12. Frontend tests
13. Production build
14. End-to-end tests when infrastructure supports them
15. Build-artifact upload when useful

Use dependency caching when supported.

Do not claim the remote CI workflow passed unless it actually ran remotely.

Run equivalent commands locally and report their results.

## Continuous Deployment

Do not invent a deployment target.

If the existing project already contains a deployment pipeline:

* Preserve it.
* Update it only as required for the changed application.
* Keep deployment dependent on successful CI.
* Do not expose secrets.

If no deployment target exists:

* Configure CI and release/build validation only.
* Do not create a fake deployment.
* Document that continuous deployment requires the user to choose and configure a deployment target.

---

# 6. BASELINE VERIFICATION

Before changing the application:

1. Record the current Git status.
2. Record the current branch.
3. Record the latest commit.
4. Install dependencies when needed.
5. Prepare the development database when needed.
6. Run existing migrations.
7. Run existing unit tests.
8. Run existing integration tests.
9. Run existing frontend tests.
10. Run lint and type checks.
11. Run the production build.
12. Run end-to-end tests when already configured.

Record baseline failures separately from failures introduced by the transformation.

Do not report a command as successful unless it actually ran successfully.

---

# 7. PRESERVE EXISTING LOGIN AND REGISTRATION

Keep the current authentication and user-account system.

Preserve:

* Existing users
* Existing user IDs
* Existing manager accounts
* Existing usernames
* Existing email addresses
* Existing phone values
* Existing password or PIN hashes
* Existing account status
* Existing authentication method
* Existing session or token format
* Existing login lockout behavior
* Existing rate limiting
* Existing login UI behavior
* Existing security protections

Do not reset the database or recreate users unnecessarily.

## Existing PIN Login

If the existing application uses a four-digit PIN:

* Keep PIN login.
* Keep PIN values hashed.
* Never log or store plaintext PIN values.
* Preserve keyboard and keypad input.
* Preserve masked PIN display.
* Preserve clear and backspace controls.
* Preserve auto-submit when implemented.
* Preserve generic credential errors.
* Preserve the existing lockout behavior.

Do not replace PIN authentication with password authentication.

## Existing Password Login

If the existing application uses passwords:

* Preserve password login.
* Preserve current password validation.
* Preserve password hashing.
* Do not convert it to PIN authentication.

Do not add a duplicate login mechanism unless one already exists.

---

# 8. SUPPORT MULTIPLE USERS

The completed application is multi-user.

If the existing project currently limits registration to the first profile:

* Remove that single-user limitation safely.
* Preserve the first user's account.
* Preserve existing login behavior.
* Allow additional users to register.
* Make new registrations regular users by default.

Do not allow unrestricted public registration as a manager.

Managers must be:

* Existing manager users
* Created through a protected seed process
* Promoted through protected manager functionality
* Created using another existing secure administrative mechanism

---

# 9. USER ROLES

Support two effective access levels:

* Regular User
* Manager

Use the existing stored role values when practical.

For example, when the project currently uses:

```text
EMPLOYEE
MANAGER
```

it is acceptable to keep `EMPLOYEE` in the database and show `User` in the interface.

Do not perform a risky role migration only to rename the value.

## Regular User

A regular user can:

* Register
* Log in
* View their profile
* Add applications
* Bulk import applications
* View only their own applications
* Edit only their own applications
* Delete only their own applications
* Change stages on their own applications
* Track their own interviews
* Track their own rejections
* Track their own follow-ups
* Track their own professional contacts
* Create and manage their own daily goals
* Create and manage their own weekly goals
* View only their own dashboard
* Export only their own data when export is implemented

## Manager

A manager can:

* Perform regular-user actions for their own records
* View all registered users
* Search users
* View all applications
* Filter records by user
* View all interviews
* View all rejections
* View all follow-ups
* View all networking contacts
* View all daily and weekly goals
* View bulk-import history
* View an individual user's dashboard
* View an aggregate manager dashboard
* Create records for a selected user
* Edit user-owned records when necessary
* Delete user-owned records when necessary
* Activate or deactivate users when supported
* Change roles when protected by manager authorization

Manager viewing must not impersonate the selected user or change record ownership.

---

# 10. DATA OWNERSHIP AND SECURITY

Every user-created record must contain an owner linked to a user.

Follow the project's naming convention:

* `user_id`
* `userId`
* `owner_id`
* `ownerId`

Do not mix naming styles without reason.

Ownership must exist on:

* Applications
* Application activity records
* Interviews
* Rejections
* Follow-ups
* Networking contacts
* Daily goals
* Weekly goals
* Import batches
* Import rows or import errors
* Audit records

## Regular-User Rules

For regular users:

* Derive owner identity from the authenticated session.
* Do not trust owner fields in the request.
* Reject or ignore client-provided owner fields.
* Scope all list queries to the authenticated user.
* Scope all detail queries to the authenticated user.
* Scope all update queries to the authenticated user.
* Scope all delete queries to the authenticated user.
* Verify the ownership of related records.
* Prevent access by guessing record IDs.
* Prevent access by changing a URL.
* Prevent access by modifying browser data.
* Prevent access through manually crafted API calls.
* Return the project's standard `403` or `404`.
* Do not reveal whether another user's record exists.

Regular users must not be able to override fields such as:

```text
user_id
userId
owner_id
ownerId
created_by
createdBy
updated_by
updatedBy
role
is_manager
```

## Manager Rules

Managers may:

* Query all records.
* Filter records by owner.
* Select an owner when creating a record for a user.
* Import applications for a selected user.
* Edit and delete user records when authorized.

Manager operations must preserve:

* Record owner
* Actor who performed the operation
* Creation timestamp
* Modification timestamp

Authorization must be enforced in the backend or server-side data layer.

Frontend-only hiding is insufficient.

---

# 11. REMOVE OR REPLACE THE CURRENT USE CASE

Replace functionality that belongs only to the old use case.

If the project contains attendance or timesheet functionality, identify and replace:

* Clock-in and clock-out interfaces
* Timesheet forms
* Timesheet tables
* Attendance dashboards
* Manager timesheet pages
* Attendance routes
* Attendance validation
* Attendance navigation
* Attendance seed data
* Attendance tests

Preserve reusable infrastructure such as:

* Authentication
* Registration
* User management
* Role guards
* Pagination
* Search
* Filters
* Tables
* Forms
* Modals
* Layouts
* Navigation components
* Validation helpers
* Audit utilities
* Database utilities
* API clients
* Test utilities

Do not drop old database tables blindly.

Inspect whether they contain data.

When old tables contain data:

* Preserve them temporarily
* Archive them
* Migrate them when meaningful
* Remove them only through a deliberate migration

Document the chosen approach.

---

# 12. CENTRAL APPLICATION DESIGN

The Job Application is the central record.

Related data should link to the application:

```text
Job Application
├── Activity Timeline
├── Interview Rounds
├── Rejection Details
├── Follow-Up Tasks
├── Networking Contacts
└── Resume Version Used
```

Do not create duplicate application records when the application changes stage.

Company and job-title information should normally come from the related application instead of being copied into every child record.

---

# 13. JOB APPLICATION MODEL

Create or update the Job Application model.

## Required Fields

* ID
* Owner/user ID
* Company
* Job title
* Date applied
* Current stage
* Created timestamp
* Updated timestamp

## Optional Fields

* Job posting URL
* Location
* Work arrangement
* Employment type
* Date found
* Application source
* Priority
* Salary minimum
* Salary maximum
* Salary currency
* Salary range text
* Resume version
* Cover-letter version
* Recruiter name
* Recruiter email
* Recruiter phone
* Job description
* Notes
* Next action
* Next-action date
* Last-response date
* External job identifier
* Created-by user ID
* Updated-by user ID

Optional fields must not prevent saving.

## Work Arrangement Values

* Remote
* Hybrid
* Onsite

## Employment Type Values

* Full-time
* Part-time
* Contract
* Internship
* Temporary
* Other

## Priority Values

* Low
* Medium
* High

Use `Medium` as the default unless an existing intentional default should be preserved.

## Active Stages

* Saved
* Preparing
* Applied
* Assessment
* Recruiter Screen
* Interview
* Final Interview
* Offer

## Final Stages

* Rejected
* Withdrawn
* Ghosted
* Position Closed
* Accepted

Use the existing project's enum or validation approach.

Do not silently accept unsupported values.

---

# 14. APPLICATION ACTIVITY HISTORY

Create an activity-history system for meaningful application changes.

Track at least:

* Application created
* Application updated
* Stage changed
* Interview added
* Rejection recorded
* Follow-up added
* Follow-up completed
* Networking contact linked

Activity fields should include:

* ID
* Application ID
* Owner/user ID
* Actor user ID
* Activity type
* Previous stage, nullable
* New stage, nullable
* Note, nullable
* Timestamp

When a stage changes:

1. Update the existing application.
2. Preserve the previous stage.
3. Save the new stage.
4. Save the actor.
5. Create one activity entry.
6. Refresh dashboard statistics.

Do not create a new application when the stage changes.

Changing the stage to `Interview` should make the application appear in interview-related views.

Do not create an empty interview record automatically.

Changing the stage to `Rejected` should allow rejection details to be recorded.

Do not create an incomplete rejection record automatically.

---

# 15. INDIVIDUAL APPLICATION ENTRY

Create an Add Application page and corresponding server operation.

Minimum required fields:

* Company
* Job title
* Date applied

The form should support the complete application model.

The form must:

* Validate required fields.
* Validate dates.
* Validate URLs.
* Validate email addresses.
* Validate supported stage values.
* Validate priority.
* Validate work arrangement.
* Validate employment type.
* Preserve entered values after errors.
* Display useful field-level errors.
* Automatically assign the authenticated user.
* Prevent regular users from selecting another owner.
* Allow managers to select an owner.
* Create the application.
* Create an application-created activity.
* Refresh the application list.
* Refresh dashboard metrics.

Reasonable defaults:

* Stage: Applied
* Priority: Medium
* Date applied: current local date

Preserve existing intentional defaults when present.

---

# 16. BULK APPLICATION INPUT

Users must be able to add multiple applications in one operation.

Support:

1. JSON
2. Structured text

Create a dedicated Bulk Import page.

The page must contain:

* Input-format selector
* Large text area
* Example input
* Copy-example action
* Clear-input action
* Validate button
* Preview table
* Import-mode selector
* Duplicate-action selector
* Import button
* Progress state
* Success summary
* Failure summary
* Row-level errors

Validation and preview must happen before permanent import.

Clicking Validate must not save applications.

The import operation must validate again on the server.

---

# 17. JSON BULK FORMAT

Accept a top-level JSON array.

Example:

```json
[
  {
    "company": "ABC Technologies",
    "job_title": "QA Engineer",
    "location": "Houston, TX",
    "work_arrangement": "Hybrid",
    "employment_type": "Full-time",
    "date_applied": "2026-08-03",
    "source": "LinkedIn",
    "stage": "Applied",
    "priority": "High",
    "job_url": "https://example.com/jobs/123",
    "resume_version": "QA_Resume_v4",
    "next_action": "Send recruiter follow-up",
    "next_action_date": "2026-08-10",
    "notes": "Applied through the company website"
  },
  {
    "company": "XYZ Financial",
    "job_title": "Software Tester",
    "location": "Dallas, TX",
    "work_arrangement": "Onsite",
    "employment_type": "Full-time",
    "date_applied": "2026-08-03",
    "source": "Indeed",
    "stage": "Applied",
    "priority": "Medium"
  }
]
```

JSON rules:

* Top-level input must be an array.
* Each element must be an object.
* Each object represents one application.
* Reject an empty array with a useful message.
* Validate each row independently.
* Preserve original row numbers.
* Report missing required fields.
* Report malformed values.
* Report invalid enums.
* Report invalid dates.
* Report invalid URLs.
* Report invalid emails.
* Report unknown fields.
* Do not silently discard invalid information.

---

# 18. STRUCTURED-TEXT BULK FORMAT

Accept `field: value` lines.

Separate applications with:

```text
---
```

Example:

```text
company: ABC Technologies
job_title: QA Engineer
location: Houston, TX
work_arrangement: Hybrid
employment_type: Full-time
date_applied: 2026-08-03
source: LinkedIn
stage: Applied
priority: High
job_url: https://example.com/jobs/123
resume_version: QA_Resume_v4
next_action: Send recruiter follow-up
next_action_date: 2026-08-10
notes: Applied through company website
---

company: XYZ Financial
job_title: Software Tester
location: Dallas, TX
work_arrangement: Onsite
employment_type: Full-time
date_applied: 2026-08-03
source: Indeed
stage: Applied
priority: Medium
```

Parser rules:

* Ignore blank lines.
* Use `---` as the application separator.
* Split each field at the first colon only.
* Preserve later colons inside the value.
* Trim whitespace.
* Treat field names as case-insensitive.
* Normalize supported aliases.
* Require company, job title, and date applied.
* Reject malformed lines.
* Report unknown fields.
* Do not silently ignore unsupported values.

Supported aliases should include:

```text
company_name -> company
title -> job_title
role -> job_title
application_status -> stage
status -> stage
application_stage -> stage
applied_date -> date_applied
date -> date_applied
url -> job_url
job_link -> job_url
work_type -> work_arrangement
resume -> resume_version
cover_letter -> cover_letter_version
```

Document all supported aliases.

---

# 19. BULK FIELD CONTRACT

Canonical import fields may include:

```text
company
job_title
job_url
location
work_arrangement
employment_type
date_found
date_applied
source
stage
priority
salary_min
salary_max
salary_currency
salary_range
resume_version
cover_letter_version
recruiter_name
recruiter_email
recruiter_phone
job_description
notes
next_action
next_action_date
last_response_date
external_job_id
```

Unknown fields must produce a consistent validation error or warning.

Document the selected policy.

Regular users must not provide ownership or authorization fields.

Reject fields such as:

```text
user_id
userId
owner_id
ownerId
created_by
createdBy
updated_by
updatedBy
role
is_manager
```

Managers must select the target owner through a protected control outside the imported row data.

---

# 20. BULK PREVIEW

Before import, show a preview table containing:

* Row number
* Company
* Job title
* Date applied
* Stage
* Priority
* Validation result
* Duplicate result
* Validation messages
* Duplicate-match information

Possible row results:

* Valid
* Valid with warning
* Invalid
* Possible duplicate

The preview must not save records.

The user must be able to edit the input and validate again.

Permanent import must repeat server-side validation.

---

# 21. IMPORT MODES

Support two modes.

## Valid Rows Only

* Import valid rows.
* Skip invalid rows.
* Do not abort valid rows because another row is invalid.
* Return row-level failures.

## All or Nothing

* Import nothing when any row is invalid.
* Use one database transaction.
* Roll back all changes if any row fails during import.

Return:

* Import batch ID
* Total rows
* Valid rows
* Invalid rows
* Duplicate rows
* Created rows
* Updated rows
* Skipped rows
* Rejected rows
* Created application IDs
* Row-level errors

Create an Import Batch record for every permanent import attempt.

---

# 22. DUPLICATE DETECTION

Check both individual and bulk entry for likely duplicates.

Primary matching:

* Same owner
* Same normalized company
* Same normalized job title
* Same date applied

When available, also compare normalized job URLs.

Normalization should:

* Trim whitespace.
* Compare company and job title case-insensitively.
* Remove harmless trailing URL slashes.
* Preserve meaningful URL values.

Duplicate actions:

* Skip
* Import anyway
* Update existing

Do not automatically merge, overwrite, or delete.

When updating an existing record:

* Preserve the application ID.
* Preserve owner.
* Update only documented fields.
* Create an application activity.
* Return the updated ID.

One duplicate action may apply to the full batch in the first version, provided all duplicates are clearly shown in preview.

---

# 23. APPLICATION LIST

Create a searchable, sortable, paginated application table.

Columns:

* Date applied
* Company
* Job title
* Location
* Work arrangement
* Stage
* Priority
* Source
* Resume version
* Next action
* Next-action date
* Last updated

Actions:

* View
* Edit
* Change stage
* Add interview
* Add follow-up
* Mark rejected
* Duplicate application
* Delete

Filters:

* Stage
* Company
* Job title
* Applied-date range
* Priority
* Source
* Location
* Work arrangement
* Employment type
* Resume version
* Follow-up status
* Pending next action
* Overdue next action

Support:

* Search
* Sorting
* Pagination
* Clear filters
* Loading state
* Empty state
* Error state

Managers receive an additional user filter.

A table view is mandatory.

A Kanban view is optional and lower priority.

---

# 24. APPLICATION DETAIL PAGE

Create a detail page containing:

* Main application data
* Current stage
* Activity timeline
* Interview rounds
* Rejection details
* Follow-ups
* Linked networking contacts
* Resume version
* Notes
* Next action

Actions:

* Edit
* Change stage
* Add interview
* Add rejection details
* Add follow-up
* Link contact
* Delete

Regular users can access only their records.

Managers can access all records.

---

# 25. INTERVIEW TRACKER

An application may contain multiple interview rounds.

Fields:

* ID
* Owner/user ID
* Application ID
* Interview round
* Interview type
* Scheduled date and time
* Time zone
* Interview format
* Meeting link
* Interviewer names
* Interviewer contact information
* Preparation notes
* Questions expected
* Questions asked
* Performance notes
* Thank-you message status
* Follow-up date
* Result
* Next step
* Notes
* Created timestamp
* Updated timestamp

Interview types:

* Recruiter Screen
* Hiring Manager
* Behavioral
* Technical
* Coding
* Panel
* Final Interview
* Other

Formats:

* Phone
* Video
* Onsite
* Other

Support:

* Upcoming interviews
* Past interviews
* Create
* View
* Edit
* Delete
* Filter by date
* Filter by type
* Filter by result
* Filter by application
* Manager filter by user

Adding an interview must create application activity.

---

# 26. REJECTION TRACKER

Fields:

* ID
* Owner/user ID
* Application ID
* Rejection date
* Stage at rejection
* Rejection reason
* Feedback received
* Recruiter feedback
* Lessons learned
* Eligible for reapplication
* Reapplication date
* Notes
* Created timestamp
* Updated timestamp

Company and job title must come from the related application.

Support:

* Create
* View
* Edit
* Delete
* Filter by rejection stage
* Filter by date
* Filter by reapplication eligibility
* Manager filter by user

Recording a rejection should:

* Link to the current application.
* Set the application stage to Rejected when appropriate.
* Avoid duplicate rejection records for the same event.
* Create application activity.

---

# 27. FOLLOW-UP TRACKER

A follow-up may relate to:

* Application
* Interview
* Networking contact

Fields:

* ID
* Owner/user ID
* Application ID, nullable
* Interview ID, nullable
* Networking-contact ID, nullable
* Follow-up type
* Contact name
* Communication channel
* Due date
* Sent date
* Status
* Response status
* Next follow-up date
* Notes
* Created timestamp
* Updated timestamp

Stored statuses:

* Due
* Sent
* Waiting
* Responded
* No Response
* Completed
* Cancelled

Calculate date-based states when practical:

* Due Today
* Overdue

Support:

* Due today
* Overdue
* Upcoming
* Waiting
* Completed
* Cancelled
* Filter by application
* Filter by contact
* Manager filter by user

Completing an application-linked follow-up should create application activity.

---

# 28. NETWORKING TRACKER

Fields:

* ID
* Owner/user ID
* Related application ID, nullable
* Contact name
* Company
* Job title
* LinkedIn URL
* Email
* Phone
* Relationship type
* Connection-request date
* Connection accepted
* First message sent
* Response received
* Referral requested
* Referral received
* Last-contact date
* Next follow-up date
* Networking stage
* Notes
* Created timestamp
* Updated timestamp

Networking stages:

* Identified
* Connection Sent
* Connected
* Message Sent
* Responded
* Referral Requested
* Referred
* Closed

Support:

* Create
* View
* Edit
* Delete
* Search by name
* Filter by company
* Filter by stage
* Filter by referral status
* Filter by follow-up date
* Manager filter by user

A contact does not have to be linked to an application.

---

# 29. DAILY GOALS

Allow users to create goals for a date.

Categories:

* Applications submitted
* Jobs researched
* Resume versions prepared
* Recruiter messages sent
* Connection requests sent
* Follow-ups completed
* Interview-preparation minutes

Store target values.

Calculate actual progress automatically when possible.

Examples:

* Applications submitted from applications with the selected date.
* Completed follow-ups from follow-up records.
* Connection requests from networking records when reliable.
* Interview-preparation minutes may be manual.

Prevent duplicate daily-goal records for the same user and date unless versioning is intentional.

Display progress such as:

```text
Applications: 7 of 10
Connections: 4 of 5
Follow-ups: 3 of 4
```

Users manage only their goals.

Managers may view all users' goals.

---

# 30. WEEKLY GOALS

Use a clearly defined week.

Use existing locale behavior or Monday through Sunday when no rule exists.

Fields:

* Owner/user ID
* Week start
* Week end
* Application target
* Networking target
* Follow-up target
* Interview-preparation target
* Custom goal label
* Custom goal target
* Custom goal completed
* Main accomplishment
* Main challenge
* Applications generating responses
* Priorities for next week
* Notes

Calculate completion percentages safely.

Avoid divide-by-zero.

Prevent duplicate weekly goals for the same user and week.

---

# 31. USER DASHBOARD

The regular-user dashboard must use only the authenticated user's data.

## Today

Display:

* Applications submitted today
* Daily application target
* Daily progress
* Follow-ups due today
* Overdue follow-ups
* Upcoming interviews
* Networking actions due
* Applications with pending next actions

## Pipeline

Display counts for:

* Saved
* Preparing
* Applied
* Assessment
* Recruiter Screen
* Interview
* Final Interview
* Offer
* Rejected
* Accepted

## Performance

Display:

* Applications today
* Applications this week
* Applications this month
* Total active applications
* Response rate
* Interview conversion rate
* Rejection rate
* Offer rate
* Acceptance rate
* Average time to first response when calculable
* Applications by source
* Applications by resume version
* Applications by work arrangement
* Applications by stage

## Recent Activity

Display:

* Applications created
* Stage changes
* Interviews scheduled
* Rejections recorded
* Follow-ups completed
* Networking updates

Use shared server-side metric calculations.

Handle empty datasets and divide-by-zero safely.

Document formulas.

Suggested formulas:

```text
Interview Conversion Rate =
applications that reached an interview stage
divided by total submitted applications
multiplied by 100

Rejection Rate =
rejected applications
divided by total submitted applications
multiplied by 100

Offer Rate =
applications that reached offer or accepted
divided by total submitted applications
multiplied by 100

Acceptance Rate =
accepted applications
divided by total submitted applications
multiplied by 100
```

Define Response Rate consistently and document the definition.

---

# 32. MANAGER DASHBOARD

Create a manager-only dashboard showing:

* Total users
* Active users
* Inactive users
* Total applications
* Applications today
* Applications this week
* Applications this month
* Applications by user
* Applications by stage
* Applications by source
* Upcoming interviews across users
* Overdue follow-ups across users
* Rejections by stage
* Offers
* Acceptances
* Daily-goal progress by user
* Weekly-goal progress by user
* Recent activity
* Recent imports

Allow a manager to select a user and view that user's dashboard data.

This must not:

* Change authentication identity.
* Impersonate the user.
* Change ownership.
* Expose manager controls to regular users.

---

# 33. USER MANAGEMENT

Create or preserve a manager-only user-management page.

Display:

* User
* Username
* Name
* Email
* Phone
* Role
* Active status
* Registration date
* Application count
* Interview count
* Follow-up count
* Last activity when available

Manager actions may include:

* Activate
* Deactivate
* Promote to manager
* Demote to regular user

Add safeguards:

* Do not allow deactivating the only manager without warning.
* Do not allow demoting the only manager.
* Do not allow public registration as manager.
* Do not allow unauthorized role changes.

Preserve correct existing behavior.

---

# 34. NAVIGATION

Replace obsolete use-case navigation.

## Public

* Login
* Register

## Regular User

* Dashboard
* Applications
* Add Application
* Bulk Import
* Interviews
* Rejections
* Follow-Ups
* Networking
* Daily Goals
* Weekly Goals
* Profile
* Settings

## Manager Only

* Manager Dashboard
* User Management
* All Applications
* All Interviews
* All Rejections
* All Follow-Ups
* All Networking Records
* User Goal Progress
* Import History

Reuse the current:

* Layout
* Sidebar
* Header
* Mobile menu
* Theme
* Dark mode
* Route guards
* Tables
* Forms
* Modals
* Loading states
* Error states

Remove broken or obsolete links.

---

# 35. API AND SERVICE DESIGN

Follow current API conventions.

Implement operations for:

* Application CRUD
* Application-stage changes
* Application activity
* Bulk validation
* Bulk import
* Import history
* Interview CRUD
* Rejection CRUD
* Follow-up CRUD
* Networking CRUD
* Daily-goal CRUD
* Weekly-goal CRUD
* User dashboard
* Manager dashboard
* Manager user listing
* Manager cross-user data

Use shared backend services for:

* Ownership checks
* Related-record ownership
* Application validation
* Application creation
* Application updates
* Stage changes
* Activity creation
* Duplicate detection
* JSON parsing
* Structured-text parsing
* Import validation
* Import execution
* Dashboard metrics
* Pagination
* Sorting
* Filtering

Do not duplicate business rules across routes.

Do not place critical authorization only in frontend code.

---

# 36. DATABASE MIGRATIONS

Use the existing migration system.

Do not create tables automatically at runtime instead of migrations.

Migrations must:

* Preserve users.
* Preserve user IDs.
* Preserve password or PIN hashes.
* Preserve manager roles.
* Preserve active status.
* Add required job-search tables.
* Add ownership foreign keys.
* Add indexes.
* Add timestamps.
* Preserve existing job-search records.
* Avoid destructive resets.
* Work on a fresh database.
* Work on the current development database.

Recommended indexes include:

* Application owner and date applied
* Application owner and stage
* Application owner, company, and job title
* Interview owner and scheduled date
* Follow-up owner and due date
* Networking owner and next follow-up date
* Daily-goal owner and date
* Weekly-goal owner and week start
* Import owner and creation date

If obsolete tables exist:

* Inspect whether they contain data.
* Do not drop them blindly.
* Archive, preserve, or remove them intentionally.
* Document the decision.

Run migration status verification after migration.

---

# 37. IMPORT HISTORY

Create Import Batch tracking.

Fields should include:

* ID
* Owner/user ID
* Actor user ID
* Input format
* Import mode
* Duplicate action
* Total rows
* Valid rows
* Invalid rows
* Duplicate rows
* Created rows
* Updated rows
* Skipped rows
* Rejected rows
* Status
* Created timestamp
* Completed timestamp

Track row-level failures using:

* A related import-row table
* A related import-error table
* Or a structured field consistent with the project architecture

Managers can view all imports.

Regular users should be able to view their own import history when practical.

Do not store passwords, PINs, tokens, or authentication secrets in import history.

---

# 38. VALIDATION AND ERRORS

Use the existing error-response format.

Validate:

* Required fields
* Dates
* Date ranges
* URLs
* Email addresses
* Salary values
* Enum values
* Pagination
* Sorting
* Filters
* Ownership
* Related-record ownership
* Bulk JSON structure
* Structured-text syntax
* Unknown fields
* Duplicate action
* Import mode
* Manager-selected owner

Errors must:

* Be understandable.
* Avoid stack traces.
* Avoid leaking another user's data.
* Include row numbers for bulk errors.
* Preserve form values when possible.
* Never silently discard invalid fields.

---

# 39. FRONTEND QUALITY

The UI must be practical for users entering many applications daily.

Requirements:

* Responsive
* Accessible
* Keyboard usable
* Clear labels
* Clear focus states
* Loading indicators
* Success messages
* Error messages
* Confirmation before deletion
* Empty states
* Search
* Filters
* Pagination
* Copyable bulk examples
* Import preview
* Row-level errors
* Disabled import until appropriate validation
* Dashboard refresh after changes

Group long forms into sections:

* Job Information
* Application Details
* Recruiter Information
* Documents
* Next Action
* Notes

Prioritize working functionality over decorative animation.

---

# 40. TESTING

Preserve and update the existing test infrastructure.

Rewrite or remove obsolete use-case tests.

## Authentication Tests

Verify:

1. Existing login works.
2. Existing registration works.
3. Multiple users can register.
4. Existing manager can log in.
5. Existing hashes remain valid.
6. Existing lockout behavior remains valid.
7. Public users cannot register as managers.

## Ownership Tests

Verify:

1. User A can create an application.
2. User A sees their applications.
3. User B cannot list User A's application.
4. User B cannot retrieve User A's application by ID.
5. User B cannot update User A's application.
6. User B cannot delete User A's application.
7. User B cannot create related records for User A's application.
8. Bulk import cannot override ownership.
9. Non-managers cannot access manager APIs.

## Manager Tests

Verify:

1. Manager can list users.
2. Manager can view all applications.
3. Manager can filter by user.
4. Manager can view a user's dashboard.
5. Manager dashboard aggregates users.
6. Manager can create an application for a selected user.
7. Manager actions preserve ownership.

## Application Tests

Verify:

1. Required fields.
2. Optional fields.
3. Create.
4. Read.
5. Update.
6. Delete.
7. Stage change.
8. Activity history.
9. Duplicate detection.
10. Filtering.
11. Sorting.
12. Pagination.

## Bulk Tests

Verify:

1. Valid JSON array.
2. Invalid non-array JSON.
3. Valid structured text.
4. First-colon splitting.
5. Blank-line handling.
6. Record separator.
7. Unknown-field errors.
8. Row-level errors.
9. Preview saves nothing.
10. Import revalidates.
11. Valid-rows-only behavior.
12. All-or-nothing rollback.
13. Duplicate skip.
14. Duplicate import-anyway.
15. Duplicate update.
16. Manager-selected owner.
17. User owner override rejection.

## Tracker Tests

Verify:

1. Multiple interviews per application.
2. Rejection linkage.
3. Application follow-up linkage.
4. Interview follow-up linkage.
5. Networking follow-up linkage.
6. Independent networking contacts.
7. Related-record ownership.

## Goal and Dashboard Tests

Verify:

1. Daily-goal uniqueness.
2. Weekly-goal uniqueness.
3. User dashboard data isolation.
4. Manager dashboard aggregation.
5. Divide-by-zero handling.
6. Date calculations.

## Frontend Tests

Verify:

1. Unauthenticated redirect.
2. Non-manager manager-route redirect.
3. Application form submission.
4. Validation errors.
5. Application table.
6. Filters.
7. Bulk preview.
8. Row errors.
9. Bulk import submission.
10. Manager user filter.
11. Dashboard empty state.
12. Dashboard populated state.

## End-to-End Tests

When E2E infrastructure exists, test:

1. Registration.
2. Login.
3. Add application.
4. Bulk import.
5. Stage change.
6. Add interview.
7. Add follow-up.
8. Create goals.
9. User dashboard.
10. Manager user view.

Do not report blocked E2E tests as passed.

---

# 41. CI QUALITY GATES

Configure the CI workflow so a change cannot be considered successful until applicable checks pass.

Recommended quality gates:

## Stage 1: Static Validation

* Dependency lockfile validation
* Formatting check
* Lint
* Type checking

## Stage 2: Backend

* Database generation
* Migration validation
* Unit tests
* Integration tests

## Stage 3: Frontend

* Frontend tests
* Production build

## Stage 4: End-to-End

* Test database setup
* Application startup
* E2E tests

Run Stage 4 only when the repository has the required infrastructure.

## Stage 5: Release Validation

* Confirm clean build
* Confirm no secrets
* Confirm migration files exist
* Upload build artifacts when useful

Do not add commands that the project does not support.

---

# 42. README

Update README documentation with:

* Project purpose
* Technology stack
* Authentication behavior
* User roles
* Ownership model
* Database setup
* Migration commands
* Development commands
* Test commands
* Lint commands
* Type-check commands
* Build commands
* Git workflow
* Branch strategy
* CI workflow
* Application entry
* JSON import
* Structured-text import
* Supported field names
* Supported aliases
* Import modes
* Duplicate actions
* Dashboard formulas
* Seed users
* Existing limitations
* Any preserved obsolete tables
* Blocked verification

Do not document unimplemented features.

---

# 43. IMPLEMENTATION ORDER

Perform the work in this order:

1. Inspect repository.
2. Inspect Git.
3. Initialize Git when absent.
4. Create baseline commit when Git is new.
5. Create or choose development branch.
6. Inspect authentication.
7. Inspect database.
8. Run baseline tests.
9. Record baseline failures.
10. Preserve login and registration.
11. Enable multiple users.
12. Design ownership.
13. Design database migration.
14. Add models and migrations.
15. Run migration validation.
16. Commit data-model stage.
17. Add ownership and authorization.
18. Add application CRUD.
19. Add activity history.
20. Add stage changes.
21. Add duplicate detection.
22. Commit application stage.
23. Add JSON parser.
24. Add structured-text parser.
25. Add preview.
26. Add permanent import.
27. Add import history.
28. Commit bulk-import stage.
29. Add interviews.
30. Add rejections.
31. Add follow-ups.
32. Add networking.
33. Commit tracker stage.
34. Add daily goals.
35. Add weekly goals.
36. Add user dashboard.
37. Add manager dashboard.
38. Add user management.
39. Commit dashboard stage.
40. Replace obsolete navigation and pages.
41. Add tests.
42. Add or update CI.
43. Run all applicable checks.
44. Fix introduced failures.
45. Update README.
46. Commit tests and documentation.
47. Review for obsolete code.
48. Review for ownership vulnerabilities.
49. Review Git history.
50. Report final status.

Do not stop after creating placeholder pages or database models.

Implement working database-to-backend-to-frontend flows.

---

# 44. PRIORITY ORDER

When the work is too large for one pass, follow this order.

## Priority 1 — Core Required Functionality

* Existing authentication
* Multi-user registration
* User and manager roles
* Ownership isolation
* Individual application entry
* Application list
* Application edit
* Application delete
* Stage tracking
* JSON bulk input
* Structured-text bulk input
* Import preview
* Permanent import
* Duplicate detection
* User dashboard
* Manager dashboard
* Manager user and data views
* Git and CI setup

## Priority 2 — Required Trackers

* Application activity
* Interviews
* Rejections
* Follow-ups
* Networking
* Daily goals
* Weekly goals
* Import history

## Priority 3 — Enhancements

* CSV export
* Kanban view
* Advanced analytics
* Saved filters
* Soft-delete recovery
* Additional charts

Do not create empty placeholders across every section at the expense of working Priority 1 functionality.

---

# 45. FINAL VERIFICATION

Verify:

## Authentication

* Existing users can log in.
* Existing manager can log in.
* New users can register.
* Multiple users can exist.
* Password or PIN hashes remain secure.
* Lockout works.
* Public users cannot become managers.

## Ownership

* User sees only their records.
* User cannot access another user's record by ID.
* User cannot override owner.
* Related-record ownership works.
* Manager can view all users.
* Manager can filter by user.

## Applications

* Individual entry works.
* Optional fields work.
* Edit works.
* Delete works.
* Stage changes work.
* Activity works.
* Search works.
* Filters work.
* Sorting works.
* Pagination works.

## Bulk Input

* JSON works.
* Structured text works.
* Preview works.
* Preview saves nothing.
* Permanent import revalidates.
* Valid-rows-only works.
* All-or-nothing works.
* Duplicate actions work.
* Import history works.

## Trackers

* Multiple interviews work.
* Rejections work.
* Follow-ups work.
* Networking works.
* Daily goals work.
* Weekly goals work.

## Dashboards

* User dashboard is scoped.
* Manager dashboard aggregates users.
* Manager user selection works.
* Metrics handle empty data.
* Recent activity works.

## Git and CI

* Repository is under Git.
* Current branch is documented.
* Staged commits exist.
* No secrets are committed.
* CI workflow exists or current CI was updated.
* Local CI-equivalent checks were run.
* Remote CI status is reported only when actually available.

## Quality

* Migration works on current database.
* Migration works on a clean database when tested.
* Tests pass or blockers are documented.
* Lint passes or blockers are documented.
* Type checks pass or blockers are documented.
* Production build succeeds or blockers are documented.
* No obsolete navigation remains.
* No owner-spoofing path remains.
* No generated artifacts are unintentionally committed.

---

# 46. GIT SAFETY

Do not:

* Delete unrelated work.
* Reset the working tree.
* Run destructive cleanup without inspection.
* Force-push.
* Rewrite history.
* Delete branches.
* Merge branches.
* Push to a remote.
* Open a pull request.

unless explicitly instructed.

If uncommitted user work exists:

* Preserve it.
* Avoid overwriting it.
* Clearly report any conflicts.

If Git is newly initialized, create local commits as instructed.

If Git already exists, create commits only when repository state and user changes make doing so safe.

---

# 47. FINAL RESPONSE FORMAT

At completion, provide:

## Repository Assessment

* Current project purpose
* Backend stack
* Frontend stack
* Database
* ORM
* Migration system
* Authentication
* Registration behavior
* Role system
* Test infrastructure

## Git Assessment

* Whether Git already existed
* Initial branch
* Final branch
* Initial Git status
* Final Git status
* Remote configuration
* Commits created
* Uncommitted changes preserved

## Existing Behavior Preserved

* Login
* Registration
* Existing users
* Existing manager
* Password or PIN behavior
* Lockout
* Reusable project infrastructure

## Changes Implemented

Group by:

* Database
* Authentication
* Multi-user support
* Authorization
* Applications
* Bulk import
* Interviews
* Rejections
* Follow-ups
* Networking
* Goals
* User dashboard
* Manager dashboard
* User management
* Frontend
* Tests
* CI
* Documentation

## Files Changed

List important files:

* Created
* Modified
* Renamed
* Removed

## Database Migration

Explain:

* Migration names
* New tables
* Altered tables
* New indexes
* User preservation
* Existing-data preservation
* Treatment of obsolete tables
* Rollback considerations

## Security Verification

Explain how the system prevents:

* Cross-user access
* Owner spoofing
* Non-manager manager access
* Bulk owner override
* Related-record ownership violations
* Secret exposure

## Git Commits

List:

* Commit hash
* Commit message
* Purpose

## CI/CD

Explain:

* Existing or new CI provider
* Workflow files
* Trigger branches
* Quality gates
* Local results
* Remote results when actually available
* Whether deployment exists
* Any deployment configuration still required

## Commands Run

Provide exact commands and results for:

* Dependency installation
* Database setup
* Migration
* Migration status
* Seed
* Unit tests
* Integration tests
* Frontend tests
* End-to-end tests
* Lint
* Type check
* Production build
* Git checks

## Test Results

State:

* Passed
* Failed
* Skipped
* Blocked
* Pre-existing failures
* New failures

Do not report unexecuted commands as successful.

## Remaining Issues

List:

* Incomplete functionality
* Environment blockers
* CI blockers
* Remote-repository requirements
* Recommended next steps

## Final Status

Conclude with exactly one:

* Complete and verified
* Complete with documented verification blockers
* Partially complete

The final product must be a secure, multi-user JobSearch Manager and Job Application Tracker that adapts the existing project, preserves the current login and registration system, supports manual and bulk application entry, strictly isolates user data, gives managers controlled access to all users and records, and uses Git plus automated CI checks throughout development.
