# CODEX MASTER IMPLEMENTATION PROMPT

# Upgrade the Existing Project into a Complete JobSearch Manager and Job Application Tracker

## ROLE

You are a senior full-stack engineer working directly inside an existing project.

Inspect the current project and implement the complete JobSearch Manager and Job Application Tracker described in this specification.

Modify the existing project in place.

Do not create:

* A replacement project
* A parallel frontend
* A second backend
* A duplicate authentication system
* An unrelated database
* Placeholder-only pages
* Mock-only features presented as complete

Preserve and reuse the existing:

* Programming languages
* Frontend framework
* Backend framework
* Database
* ORM or database client
* Migration system
* Authentication system
* User model
* Role model
* UI components
* Styling system
* Testing framework
* Build tools
* Environment conventions
* Deployment configuration, when one already exists

Do not assume a specific stack before inspecting the repository.

All features in this specification are mandatory unless a feature is explicitly marked as future work. Do not implement only a partial subset and describe the rest as planned.

If a required feature is blocked by the environment, complete all unblocked work, leave the changes on the `development` branch, do not merge into `main`, and report the exact blocker.

---

# 1. PRODUCT PURPOSE

The final product is a secure, multi-user JobSearch Manager and Job Application Tracker.

Users manually record jobs they have applied to through:

1. Individual application entry
2. Quick Add
3. Bulk JSON input
4. Bulk structured-text input

The system manages:

* Job applications
* Application stages
* Application history
* Visual application timelines
* Interviews
* Rejections
* Follow-ups
* Reminders
* Networking contacts
* Resume versions
* Daily and weekly goals
* Goal history and trends
* Calendar events
* Application aging
* Stage-duration analytics
* User dashboards
* Manager dashboards
* CSV and JSON exports

The application must not:

* Search public job boards
* Scrape job websites
* Automatically discover jobs
* Automatically apply to jobs
* Automatically submit resumes
* Require a live job-search API
* Pretend manually entered applications came from an external integration

This is a manual tracking, productivity, analytics, and planning application.

---

# 2. INSPECT THE EXISTING PROJECT FIRST

Before changing code, inspect the entire project.

Determine:

* Project root
* Current branch
* Git status
* Git remotes
* Existing CI configuration
* Existing deployment configuration
* Frontend framework
* Backend framework
* Database
* ORM
* Migration system
* Authentication implementation
* Login flow
* Registration flow
* Password or PIN hashing
* Session, cookie, token, or JWT handling
* Login lockout behavior
* User model
* Role model
* Manager authorization
* Existing APIs
* Existing pages and routes
* Existing models
* Existing migrations
* Existing seed scripts
* Existing test setup
* Test database configuration
* Environment-variable conventions
* Build commands
* Lint commands
* Type-check commands
* Unit-test commands
* Integration-test commands
* End-to-end-test commands

Search for existing code related to:

* Applications
* Jobs
* Attendance
* Timesheets
* Clock in
* Clock out
* User
* Employee
* Manager
* Role
* Dashboard
* Interview
* Rejection
* Follow-up
* Reminder
* Networking
* Resume
* Goal
* Calendar
* Export
* Owner
* Single user
* Registration disabled
* First profile

Do not assume the current project still matches an old attendance specification.

Preserve working job-search features and improve them rather than rebuilding them unnecessarily.

---

# 3. BASELINE VERIFICATION

Before implementing changes:

1. Record the current Git status.
2. Record the current branch.
3. Record the latest commit when Git exists.
4. Install dependencies.
5. Generate ORM clients when required.
6. Prepare the development database.
7. Apply existing migrations.
8. Run migration status checks.
9. Run existing backend tests.
10. Run existing frontend tests.
11. Run lint.
12. Run type checking.
13. Run the production build.
14. Run existing end-to-end tests.

Record pre-existing failures separately.

Do not claim any check passed unless it was actually executed successfully.

---

# 4. GIT INITIALIZATION AND BRANCH STRATEGY

## When Git Already Exists

When the project already contains `.git`:

* Do not reinitialize Git.
* Preserve all history.
* Inspect existing branches and remotes.
* Preserve uncommitted user work.
* Do not reset or discard unrelated changes.
* Use the existing `development` branch when present.
* If `development` does not exist, create it from the appropriate current stable branch.
* Perform all implementation work on `development`.

## When Git Does Not Exist

When the project is not under Git:

1. Create or update `.gitignore`.
2. Initialize Git in the project root.
3. Create a baseline commit containing the existing project.
4. Use `main` as the baseline stable branch.
5. Create and switch to `development`.
6. Implement all changes on `development`.

Example workflow:

```bash
git init
git add .
git commit -m "chore: capture existing project baseline"
git branch -M main
git switch -c development
```

Adapt commands safely to the operating system and repository state.

## Files That Must Not Be Committed

Do not commit:

* Real environment files
* Secrets
* Tokens
* Passwords
* PINs
* Private keys
* Database credentials
* Local database files unless intentionally tracked
* Dependency directories
* Build output
* Coverage output
* Test recordings
* Browser traces
* Temporary files
* Editor-specific files
* Generated secret files

---

# 5. REMOTE REPOSITORY AND PUBLISHING

Inspect whether a remote repository exists.

## Existing Remote

When a valid remote exists and authentication is available:

* Push staged implementation commits to `development`.
* Set upstream tracking when needed.
* Do not force-push.
* Do not overwrite remote history.

## No Remote

When no remote exists:

* Check whether GitHub CLI or another configured repository-hosting tool is authenticated.
* If authenticated and authorized, create a private repository using the existing project name.
* Add it as `origin`.
* Push `main`.
* Push `development`.
* Do not create a public repository unless explicitly configured as public by the user.

If no authenticated repository-hosting tool is available:

* Complete the local Git workflow.
* Do not invent a remote URL.
* Do not claim the branch was published.
* Report the exact command required after the user creates a remote.
* Do not merge into `main` if the required remote CI validation cannot be completed and the specification requires CI validation before merging.

---

# 6. REQUIRED DEVELOPMENT-TO-MAIN WORKFLOW

The implementation must follow this order:

1. Work only on `development`.
2. Create focused commits after working stages.
3. Run local checks after each major stage.
4. Push `development`.
5. Run CI on `development`.
6. Fix all required failures on `development`.
7. Push corrections.
8. Confirm the final `development` CI run passes.
9. Review the complete diff from `main` to `development`.
10. Merge into `main` only after all mandatory features are complete.
11. Run post-merge validation.
12. Push `main`.
13. Confirm the `main` CI run passes.

Do not merge into `main` when:

* A mandatory feature is missing
* A mandatory test fails
* A migration fails
* Type checking fails
* The production build fails
* There is an unresolved security issue
* User-data isolation is not verified
* CI is blocked and has not been safely replaced with equivalent verified checks
* Uncommitted user work would be overwritten

Prefer a pull request from `development` to `main` when the remote platform supports it.

When pull requests are unavailable, use a non-fast-forward merge:

```bash
git switch main
git merge --no-ff development
```

Do not merge using force, history rewriting, or destructive resets.

---

# 7. STAGED COMMITS

Use focused commits.

Recommended stages:

```text
chore: capture existing project baseline
chore: add jobsearch data models and migrations
feat: enforce multi-user ownership and authorization
feat: implement application management and timeline
feat: implement resume tracking and analytics
feat: implement bulk application import
feat: implement interviews rejections and follow-ups
feat: implement reminder center and calendar
feat: implement goal settings history and trends
feat: implement dashboard widgets and analytics
feat: implement aging and stage duration reports
feat: implement exports and saved views
test: add complete jobsearch manager coverage
ci: add staged quality checks
docs: update jobsearch manager documentation
```

Before every commit:

* Review the staged diff.
* Confirm no secret is included.
* Run checks relevant to the stage.
* Commit only related files.
* Avoid committing broken code.

---

# 8. CI CONFIGURATION

Inspect the existing CI provider.

If CI already exists:

* Preserve the existing provider.
* Update the existing workflows.
* Do not add a competing CI system.

If CI does not exist:

* Add GitHub Actions at `.github/workflows/ci.yml`.
* Configure it for:

```yaml
push:
  branches:
    - development
    - main

pull_request:
  branches:
    - development
    - main

workflow_dispatch:
```

Use actual project commands discovered from the repository.

Required applicable CI stages:

## Stage 1: Static Quality

* Dependency installation
* Formatting check
* Lint
* Type checking

## Stage 2: Database and Backend

* Database service startup when required
* ORM/client generation
* Migration application
* Migration-status verification
* Backend unit tests
* Backend integration tests

## Stage 3: Frontend

* Frontend dependency installation
* Frontend lint
* Frontend type checking
* Frontend tests
* Production build

## Stage 4: End-to-End

When supported:

* Prepare isolated test database
* Start backend
* Start frontend
* Run end-to-end tests
* Upload traces or screenshots on failure

## Stage 5: Security and Repository Validation

* Detect accidentally committed secrets
* Confirm required migration files exist
* Confirm no prohibited generated artifacts are tracked
* Confirm production build artifacts can be generated

Use caching where supported.

Do not include nonexistent commands merely to make the workflow appear complete.

Do not claim remote CI passed unless the hosted workflow actually completed successfully.

---

# 9. PRESERVE EXISTING AUTHENTICATION

Keep the current login and registration system.

Preserve:

* Existing users
* User IDs
* Manager accounts
* Password or PIN hashes
* Usernames
* Emails
* Phone values
* Active/inactive status
* Authentication method
* Tokens or sessions
* Existing login UI
* Login lockout
* Rate limiting
* Security protections

Do not reset the database.

Do not recreate users unnecessarily.

## Existing PIN Authentication

If the project uses PIN login:

* Keep PIN login.
* Keep PINs hashed.
* Never log plaintext PIN values.
* Preserve masked entry.
* Preserve keypad input.
* Preserve keyboard input.
* Preserve backspace and clear behavior.
* Preserve auto-submit when already implemented.
* Preserve generic login errors.
* Preserve lockout rules.

## Existing Password Authentication

If the project uses passwords:

* Preserve password login.
* Preserve password hashing.
* Preserve validation rules.
* Do not convert the system to PIN authentication.

Do not add a duplicate authentication method unless one already exists.

---

# 10. MULTI-USER REGISTRATION

The final system must support multiple users.

If the existing project restricts registration after the first profile:

* Remove that restriction safely.
* Preserve the first user.
* Preserve existing credentials.
* Permit additional registrations.
* Assign new registrations the ordinary user role.

Public registration must not permit manager-role selection.

Managers may be created through:

* Existing manager accounts
* Protected manager promotion
* Protected seed functionality
* Another existing administrative mechanism

---

# 11. USER ROLES

Support two effective roles:

* Regular User
* Manager

Preserve existing stored role values when practical.

For example, an existing `EMPLOYEE` role may remain stored internally while the UI displays `User`.

## Regular User

A regular user can:

* Manage their profile
* Add applications
* Quick-add applications
* Bulk-import applications
* View only their records
* Edit only their records
* Archive and restore their applications
* Delete their records when permitted
* Track their interviews
* Track their rejections
* Track their follow-ups
* Track their networking contacts
* Track their resumes
* Configure reminders
* Configure dashboard widgets
* Configure goals
* View goal history
* View calendar events
* View analytics for their records
* Export only their data

## Manager

A manager can:

* Perform regular-user actions for their own records
* View all users
* View all users' records
* Filter by user
* View aggregate analytics
* View an individual user's dashboard
* View an individual user's calendar
* View an individual user's goal history
* Create records for a selected user
* Edit user-owned records
* Archive or delete user-owned records
* View audit logs
* Export all users or one selected user
* Activate and deactivate users
* Change roles subject to safeguards

Manager viewing must not impersonate the user or change record ownership.

---

# 12. OWNERSHIP AND DATA ISOLATION

Every user-created record must have an owner.

Ownership is required for:

* Applications
* Timeline events
* Stage history
* Interviews
* Rejections
* Follow-ups
* Networking contacts
* Resume versions
* Reminders
* Reminder categories
* Goal settings
* Goal snapshots
* Goal history
* Saved filters
* Dashboard layouts
* Import batches
* Import errors
* Tags
* Checklist items
* Audit records

For regular users:

* Derive owner from authentication.
* Never trust owner fields from the client.
* Scope all lists to the authenticated owner.
* Scope all reads to the authenticated owner.
* Scope all updates to the authenticated owner.
* Scope all deletes to the authenticated owner.
* Validate ownership of every related record.
* Do not leak the existence of another user's records.

Disallowed regular-user request fields include:

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

Managers may select a target owner through protected controls outside bulk row data.

All ownership enforcement must occur server-side.

---

# 13. THEME SYSTEM

Implement a complete theme system with:

* Light
* Dark
* System

Provide a visible theme switch in the main layout and Settings.

Persist the preference:

* Across refresh
* Across browser restart
* Across logout and login
* Across devices when user settings are stored server-side

When `System` is selected, follow the operating-system or browser theme.

All components must support all themes:

* Navigation
* Forms
* Tables
* Dialogs
* Timelines
* Charts
* Funnel
* Calendar
* Reminder Center
* Goal widgets
* Stage badges
* Tooltips
* Dropdowns
* Error messages
* Success messages

Charts must use theme-aware:

* Backgrounds
* Labels
* Axes
* Grid lines
* Legends
* Tooltips
* Borders

---

# 14. REMOVE DATE FOUND

Remove `date_found` from the active product.

Remove it from:

* Application model
* Add form
* Edit form
* Quick Add
* JSON import
* Structured-text import
* Preview
* APIs
* Filters
* Tables
* Dashboards
* Charts
* Exports

If the existing database contains this field:

* Preserve the old database value safely.
* Stop requiring and exposing it.
* Remove it only through a deliberate safe migration when appropriate.

Continue using:

* Date applied
* Created timestamp
* Updated timestamp
* Last-response date
* Next-action date
* Follow-up dates
* Interview dates
* Stage dates

---

# 15. JOB APPLICATION MODEL

The Job Application is the central record.

Required fields:

* ID
* Owner
* Company
* Job title
* Date applied
* Current stage
* Created timestamp
* Updated timestamp

Optional fields:

* Job URL
* Location
* Work arrangement
* Employment type
* Source
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
* Pinned
* Important
* Favorite
* Archived timestamp
* Created-by user
* Updated-by user

Work arrangements:

* Remote
* Hybrid
* Onsite

Employment types:

* Full-time
* Part-time
* Contract
* Internship
* Temporary
* Other

Priorities:

* Low
* Medium
* High

Stages:

* Saved
* Preparing
* Applied
* Assessment
* Recruiter Screen
* Interview
* Final Interview
* Offer
* Rejected
* Withdrawn
* Ghosted
* Position Closed
* Accepted

Do not silently accept unsupported stages.

---

# 16. COLOR-CODED STAGES

Use consistent stage colors everywhere.

Suggested mapping:

| Stage            | Color              |
| ---------------- | ------------------ |
| Saved            | Gray               |
| Preparing        | Violet or Slate    |
| Applied          | Blue               |
| Assessment       | Cyan               |
| Recruiter Screen | Indigo             |
| Interview        | Purple             |
| Final Interview  | Deep Purple        |
| Offer            | Amber or Gold      |
| Accepted         | Green              |
| Rejected         | Red                |
| Ghosted          | Orange             |
| Withdrawn        | Neutral Gray       |
| Position Closed  | Muted Red or Brown |

Use these colors in:

* Application tables
* Application details
* Timeline
* Funnel
* Charts
* Calendar
* Reminder Center
* Filters
* Badges
* Reports

Always include text labels.

Do not communicate meaning through color alone.

Maintain accessible contrast in light and dark modes.

---

# 17. INDIVIDUAL APPLICATION ENTRY

Create a complete Add Application page.

Required fields:

* Company
* Job title
* Date applied

Support all optional application fields.

The form must:

* Validate required values.
* Validate dates.
* Validate URLs.
* Validate emails.
* Validate enum values.
* Preserve entered data after errors.
* Display field-level errors.
* Automatically assign owner.
* Prevent owner spoofing.
* Permit manager owner selection.
* Create application activity.
* Refresh lists and dashboard data.

Reasonable defaults:

* Date applied: current local date
* Stage: Applied
* Priority: Medium

---

# 18. QUICK ADD

Create a Quick Add workflow for high-volume application entry.

Required fields:

* Company
* Job title
* Date applied

Recommended quick fields:

* Job URL
* Source
* Stage
* Priority
* Resume version

Quick Add must reuse:

* Normal application validation
* Ownership enforcement
* Duplicate detection
* Activity creation

Do not create a separate inconsistent creation path.

---

# 19. BULK APPLICATION IMPORT

Support:

1. JSON
2. Structured text

Create a Bulk Import page with:

* Format selector
* Large text area
* Example
* Copy example
* Clear input
* Validate
* Preview
* Import-mode selector
* Duplicate-action selector
* Import
* Progress
* Summary
* Row-level errors

Preview must not save data.

Permanent import must revalidate server-side.

## JSON Format

Require a top-level array of objects.

## Structured Text

Use:

```text
field: value
---
field: value
```

Parser rules:

* Ignore blank lines.
* Split on the first colon.
* Preserve later colons.
* Trim whitespace.
* Treat field names case-insensitively.
* Normalize aliases.
* Report unknown fields.
* Report malformed lines.
* Require company, job title, and date applied.

Canonical fields include:

```text
company
job_title
job_url
location
work_arrangement
employment_type
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
tags
pinned
important
favorite
```

Do not include `date_found`.

## Import Modes

Implement:

* Valid rows only
* All or nothing

## Duplicate Actions

Implement:

* Skip
* Import anyway
* Update existing

Primary duplicate match:

* Same owner
* Same normalized company
* Same normalized job title
* Same date applied

Also compare job URL when available.

Track permanent imports in Import Batch records.

---

# 20. APPLICATION LIST

Create a searchable, sortable, paginated table.

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
* Aging
* Last updated

Actions:

* Open
* Edit
* Change stage
* Add interview
* Add follow-up
* Mark rejected
* Duplicate
* Pin
* Archive
* Delete

Filters:

* Stage
* Company
* Job title
* Date range
* Priority
* Source
* Location
* Work arrangement
* Employment type
* Resume version
* Follow-up status
* Aging category
* Pinned
* Archived
* Tags
* Pending next action
* Overdue next action
* User, for managers

Application rows must be clickable.

Buttons inside rows must not trigger accidental navigation.

---

# 21. CLICKABLE APPLICATION DETAILS

Recommended route:

```text
/applications/{application_id}
```

The page must contain, in order:

1. Application header
2. Next-action card
3. Visual timeline
4. Application summary
5. Related-record tabs
6. Editable application form
7. Related applications
8. Audit information for authorized managers

Regular users may open only their own applications.

Managers may open all applications.

---

# 22. APPLICATION HEADER

Display:

* Company
* Job title
* Stage
* Priority
* Location
* Work arrangement
* Employment type
* Date applied
* Resume version
* Source
* Job URL
* Pinned status
* Archived status
* Application health

Actions:

* Change stage
* Add update
* Add interview
* Add follow-up
* Mark rejected
* Link networking contact
* Pin or unpin
* Archive or restore
* Export timeline
* Delete

---

# 23. NEXT-ACTION CARD

Display prominently:

* Next action
* Due date
* Remaining time
* Priority
* Status
* Completion control

When completed:

* Record completion date.
* Create timeline event.
* Allow the user to create the next action.
* Update dashboard and reminders.

---

# 24. VISUAL APPLICATION TIMELINE

Place the timeline near the top of the Application Details page.

Each event must support:

* Event ID
* Application ID
* Owner
* Event date
* Optional event time
* Event category
* Event type
* Stage at the time
* Title
* Description
* Contact person
* Actor
* Automatic or manual source
* Related record type
* Related record ID
* Created timestamp
* Updated timestamp

Display:

* Vertical timeline on mobile
* Responsive horizontal or vertical timeline on desktop
* Stage color
* Event icon
* Date
* Text label
* Notes
* Related-record link

## Automatic Timeline Events

Create events when:

* Application is created
* Application is updated meaningfully
* Stage changes
* Resume changes
* Interview is scheduled
* Interview is updated
* Interview is completed
* Follow-up is created
* Follow-up is sent
* Follow-up is completed
* Recruiter response is recorded
* Rejection is recorded
* Offer is recorded
* Offer is accepted
* Application is archived
* Application is restored
* Next action is completed

## Manual Timeline Events

Allow:

* Recruiter viewed application
* Recruiter called
* Recruiter emailed
* Assessment received
* Assessment submitted
* Hiring manager contacted
* Reference requested
* Reference submitted
* Background check started
* Additional documents requested
* Verbal offer received
* Custom event

Manual form:

* Event date
* Optional time
* Category
* Event type
* Optional stage change
* Note
* Contact
* Next action
* Next-action date

## Timeline Filters

Implement:

* All
* Stage changes
* Interviews
* Follow-ups
* Recruiter activity
* Rejections
* Offers
* Notes
* Automatic
* Manual

Support ascending and descending sorting.

---

# 25. DEDICATED APPLICATION TIMELINE EXPORT

This is mandatory and separate from the general account export.

On every Application Details page, provide:

* Export Timeline CSV
* Export Timeline JSON

Timeline export must respect:

* Application ownership
* Manager authorization
* Active timeline filters
* Selected date range
* Selected sort order

## Timeline CSV

Include:

* Event date
* Event time
* Event category
* Event type
* Stage
* Title
* Description
* Contact
* Automatic/manual
* Actor
* Related record type
* Created timestamp
* Updated timestamp

## Timeline JSON

Use a versioned structure:

```json
{
  "export_version": 1,
  "export_type": "application_timeline",
  "exported_at": "ISO-8601 timestamp",
  "application": {
    "id": "application-id",
    "company": "Company",
    "job_title": "Job Title"
  },
  "filters": {},
  "timeline": []
}
```

Do not include:

* Password hashes
* PIN hashes
* Tokens
* Private authentication details

Add tests proving users cannot export another user's timeline.

---

# 26. STAGE HISTORY

Persist every stage visit.

Track:

* Application
* Owner
* Previous stage
* New stage
* Entered timestamp
* Left timestamp
* Actor
* Reason
* Note

Moving backward to a previous stage must create a new stage-history record.

Do not overwrite old stage visits.

---

# 27. STAGE-DURATION ANALYTICS

Create a complete Stage-Duration Analytics report.

Display:

* Average duration per stage
* Median duration per stage
* Minimum duration
* Maximum duration
* Applications currently stalled
* Average Applied-to-first-response time
* Average Applied-to-Recruiter-Screen time
* Average Applied-to-Interview time
* Average Interview-to-Offer time
* Average Applied-to-Rejection time
* Average complete lifecycle duration

Filters:

* Date range
* Company
* Job title
* Source
* Resume version
* Work arrangement
* Employment type
* Current stage
* User, for managers

Include:

* Table
* Bar chart
* Empty state
* Insufficient-data explanation

Do not calculate a metric from records lacking the required stage history.

---

# 28. EDITABLE APPLICATION BELOW TIMELINE

Display the complete application below the timeline.

Default mode:

* Read-only

Actions:

* Edit
* Save
* Cancel

Sections:

## Job Information

* Company
* Job title
* Job URL
* Location
* Work arrangement
* Employment type
* Salary

## Application Information

* Date applied
* Source
* Stage
* Priority
* Resume
* Cover letter
* Tags

## Recruiter Information

* Name
* Email
* Phone
* Linked contact

## Action and Follow-Up

* Next action
* Next-action date
* Suggested follow-up
* Follow-up status

## Description and Notes

* Job description
* Notes
* Pinned
* Important
* Favorite

Create timeline or audit events for meaningful changes.

---

# 29. APPLICATION DETAIL TABS

Implement:

* Overview
* Timeline
* Interviews
* Follow-Ups
* Networking
* Resume
* Checklist
* Notes
* Audit History

Audit History must be manager-only unless current project policy allows user access.

---

# 30. APPLICATION CHECKLIST

Support default and custom checklist items.

Defaults:

* Resume tailored
* Correct resume selected
* Cover letter included
* Application submitted
* Recruiter identified
* Recruiter contacted
* Follow-up sent
* Assessment completed
* Interview prepared
* Thank-you note sent
* References prepared

Track:

* Completed
* Completion date
* Note
* Order
* Custom label

Show progress:

```text
6 of 10 complete
```

Checklist completion must not automatically change stage.

---

# 31. RELATED APPLICATIONS

Show other applications belonging to the same owner at the same company.

Display:

* Job title
* Stage
* Date applied
* Priority

Do not classify different roles automatically as duplicates.

Allow navigation to related applications.

---

# 32. PREVIOUS AND NEXT APPLICATION

Provide previous and next navigation.

Preserve the originating:

* Search
* Filters
* Sorting
* Saved view
* Pagination context

---

# 33. TECHNICAL AUDIT LOG

Keep the user timeline separate from the audit log.

Audit fields:

* Record type
* Record ID
* Owner
* Actor
* Action
* Field
* Previous value
* New value
* Timestamp
* Operation ID when available

Managers can view audit logs.

Never log authentication secrets.

---

# 34. RESUME TRACKER

Create a Resume Tracker.

Fields:

* ID
* Owner
* Version name
* Target role
* Job category
* File name
* Secure file reference when supported
* Date created
* Last updated
* Active/archived
* Notes
* Created timestamp
* Updated timestamp

If secure file storage does not already exist:

* Store metadata only.
* Do not add insecure file storage.

Applications may link to one resume.

A selected resume must belong to the same user.

Archiving a resume must not break old application references.

## Resume Analytics

Calculate:

* Applications
* Responses
* Assessments
* Recruiter screens
* Interviews
* Final interviews
* Offers
* Acceptances
* Rejections
* Ghosted applications
* Response rate
* Interview conversion
* Offer conversion

Display sample size beside every rate.

Implement resume comparison:

* Table
* Chart
* Date filter
* Manager user filter

---

# 35. INTERVIEW TRACKER

Support multiple interview rounds.

Fields:

* Owner
* Application
* Round
* Type
* Scheduled datetime
* Time zone
* Format
* Meeting link
* Interviewers
* Contact information
* Preparation notes
* Questions expected
* Questions asked
* Performance notes
* Thank-you status
* Follow-up date
* Result
* Next step
* Notes

Types:

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

Create timeline events for interview changes.

---

# 36. REJECTION TRACKER

Fields:

* Owner
* Application
* Rejection date
* Stage at rejection
* Reason
* Feedback
* Recruiter feedback
* Lessons learned
* Reapplication eligibility
* Reapplication date
* Notes

Derive company and job title from the application.

Recording rejection should:

* Link to the existing application.
* Set stage appropriately.
* Create stage history.
* Create timeline event.
* Avoid duplicate rejection records.

---

# 37. FOLLOW-UP TRACKING BASED ON DATE APPLIED

Application-related follow-ups must reference the application.

Calculate a suggested first follow-up date from:

```text
date applied + configured delay
```

Allow configuration for:

* First follow-up delay
* Second follow-up delay
* Calendar days or business days
* Default reminder time
* Automatic reminder creation or suggestion only

Users may override any suggested date.

Follow-up fields:

* Owner
* Application
* Interview, optional
* Networking contact, optional
* Type
* Contact
* Channel
* Suggested date
* Due date
* Sent date
* Status
* Response
* Next follow-up
* Notes

Stored statuses:

* Due
* Sent
* Waiting
* Responded
* No Response
* Completed
* Cancelled

Calculate:

* Due Today
* Overdue

Create timeline and reminder updates as appropriate.

Do not automatically send messages.

---

# 38. NETWORKING TRACKER

Fields:

* Owner
* Related application, optional
* Contact name
* Company
* Job title
* LinkedIn URL
* Email
* Phone
* Relationship
* Connection request date
* Connection accepted
* First message sent
* Response received
* Referral requested
* Referral received
* Last contact
* Next follow-up
* Stage
* Notes

Stages:

* Identified
* Connection Sent
* Connected
* Message Sent
* Responded
* Referral Requested
* Referred
* Closed

Contacts may exist without applications.

---

# 39. REMINDER CENTER

Create a unified Reminder Center.

Reminder fields:

* ID
* Owner
* Category
* Related record type
* Related record ID
* Title
* Description
* Due date
* Due time
* Priority
* Status
* Snoozed until
* Completed timestamp
* Created timestamp
* Updated timestamp

Statuses:

* Upcoming
* Due Today
* Overdue
* Snoozed
* Completed
* Cancelled

Priorities:

* Low
* Medium
* High

Actions:

* Open related record
* Complete
* Snooze
* Reschedule
* Edit
* Delete

Snooze options:

* Later today
* Tomorrow
* Three days
* One week
* Custom

Do not add email, SMS, or push delivery unless already supported.

---

# 40. REMINDER CATEGORIES AND CATEGORY MANAGEMENT

Reminder categories are mandatory.

Provide built-in categories:

* Application Follow-Up
* Interview
* Interview Preparation
* Thank-You Note
* Networking
* Recruiter Contact
* Resume
* Goal
* Reapplication
* Next Action
* Custom

Users must be able to:

* Create custom categories
* Rename their custom categories
* Select a category color
* Select a category icon when supported
* Archive custom categories
* Restore custom categories
* Filter reminders by category
* View category counts
* Set a default category
* Reassign reminders before deleting a category

Built-in categories:

* Cannot be deleted
* May be hidden when the design supports it
* Must retain stable internal identifiers

Custom categories are user-owned.

Managers may view category usage but must not silently transfer ownership.

Add category filters to:

* Reminder Center
* Dashboard reminder widget
* Calendar
* Manager reminder views

---

# 41. CALENDAR VIEW

Create:

* Month view
* Week view
* Agenda view

Events:

* Date applied
* Follow-up due
* Interview
* Interview follow-up
* Thank-you note
* Networking follow-up
* Next action
* Reapplication date
* Reminder
* Goal checkpoint

Filters:

* Applications
* Interviews
* Follow-ups
* Networking
* Reminders
* Goals
* Completed events
* Reminder category
* User, for managers

Clicking an event must open the related record.

Calendar ownership must be enforced server-side.

---

# 42. GOAL SETTINGS

Create one Goal Settings page.

Daily targets:

* Applications
* Follow-ups
* Connection requests
* Recruiter messages
* Interview-preparation minutes

Weekly targets:

* Applications
* Follow-ups
* Connections
* Recruiter messages
* Interview-preparation minutes

Support:

* Enable/disable
* Target value
* Effective date
* Optional end date
* Week-start preference
* Reset defaults

Actual progress must be calculated from activity whenever possible.

Do not require users to manually type completed counts that are derivable.

---

# 43. GOAL SNAPSHOTS AND HISTORICAL INTEGRITY

Store historical target snapshots.

When a user changes a goal:

* Do not rewrite old goal results.
* Preserve the target that applied to each day or week.
* Start the new target on its effective date.

Store daily and weekly snapshots containing:

* Owner
* Period
* Goal category
* Target
* Actual
* Completion percentage
* Achieved or missed
* Calculation timestamp

---

# 44. GOAL DASHBOARD PROGRESS

Display:

* Target
* Actual
* Percentage
* Remaining
* Progress bar
* Achieved indicator
* Missed indicator after period end

Examples:

```text
Daily applications: 7 / 10
Weekly applications: 38 / 50
Daily follow-ups: 4 / 5
Weekly connections: 17 / 25
```

Update automatically after relevant activity.

---

# 45. GOAL HISTORY AND TRENDS

Create a complete Goal History page.

Views:

* Daily
* Weekly
* Monthly aggregation

Metrics:

* Target
* Actual
* Percentage
* Achieved
* Missed
* Current streak
* Longest streak
* Average completion
* Best week
* Worst week
* Average applications per day
* Average follow-ups per week

Charts:

* Daily trend
* Weekly trend
* Category comparison
* Achieved-versus-missed comparison

Filters:

* Goal category
* Date range
* User, for managers

---

# 46. GOAL ACHIEVEMENT COMPARISON

This feature is mandatory.

Create achieved-versus-missed reporting across:

* Days
* Weeks
* Months
* Goal categories
* Users, for managers

Display:

* Number of periods achieved
* Number of periods missed
* Achievement percentage
* Average amount above target
* Average shortfall
* Longest achieved streak
* Longest missed streak

Visualizations:

* Stacked bar chart
* Percentage comparison
* Table fallback

Manager comparison must support:

* Compare selected users
* Compare teams or all users when applicable
* Filter by date range
* Filter by goal category

Do not expose one user's goal data to another regular user.

---

# 47. APPLICATION AGING

Calculate age from the most recent meaningful activity.

When no later activity exists, use date applied.

Default aging bands:

* 0–3 days: New
* 4–7 days: Waiting
* 8–14 days: Follow-Up Recommended
* 15–30 days: Stale
* More than 30 days: Long Waiting

Do not automatically mark Ghosted.

Suggest review and require confirmation.

---

# 48. APPLICATION AGING REPORT

Create a report containing:

* Application
* Company
* Job title
* Stage
* Date applied
* Last activity
* Days inactive
* Follow-up status
* Next action
* Aging category
* Owner for managers

Filters:

* Aging category
* Stage
* Date range
* Source
* Resume
* Priority
* User

Summary widgets:

* New
* Waiting
* Follow-up recommended
* Stale
* Long waiting

Actions:

* Open
* Add follow-up
* Add timeline update
* Change stage
* Mark Ghosted
* Archive

---

# 49. APPLICATION HEALTH INDICATOR

Provide:

* On Track
* Waiting
* Action Needed
* Overdue
* Closed

Use:

* Recent activity
* Next-action due date
* Follow-up status
* Interview schedule
* Days without response
* Current stage

Clearly label this as workflow health, not hiring prediction.

---

# 50. DASHBOARD WIDGET SYSTEM

Build the dashboard from reusable widgets.

Mandatory widgets:

* Applications Today
* Applications This Week
* Applications This Month
* Active Applications
* Follow-Ups Due
* Overdue Follow-Ups
* Upcoming Interviews
* Responses
* Rejections
* Ghosted
* Offers
* Acceptances
* Daily Goal Progress
* Weekly Goal Progress
* Goal Achievement Comparison
* Application Activity Chart
* Job Funnel
* Applications by Stage
* Applications by Source
* Applications by Work Arrangement
* Resume Performance
* Goal Trends
* Reminder Center
* Aging Applications
* Stage-Duration Summary
* Recent Activity
* Pinned Applications
* Application Health Summary
* Calendar Preview

All widgets must support:

* User data isolation
* Manager-selected user scope
* Date-range filtering where applicable
* Light and dark modes
* Loading state
* Empty state
* Error state
* Responsive layout

---

# 51. CONFIGURABLE DASHBOARD WIDGETS

This feature is mandatory and must be fully implemented.

Users must be able to:

* Open Dashboard Settings
* Enable widgets
* Disable widgets
* Select widget size
* Reset to default layout
* Save the layout
* Maintain separate personal dashboard preferences

Managers must be able to maintain:

* Their own manager-dashboard layout
* Their own selected widgets
* Their own ordering
* Their own sizing

Store dashboard preferences server-side.

Suggested preference data:

* Owner
* Dashboard type
* Widget identifier
* Enabled
* Position
* Width
* Height
* Widget-specific settings
* Updated timestamp

Widget-specific settings may include:

* Default date range
* Chart type
* Grouping
* Selected metrics
* Selected reminder categories
* Selected goal categories

Do not implement only hard-coded widgets with a future customization comment.

---

# 52. DASHBOARD WIDGET REORDERING

This feature is mandatory and must be complete.

Implement drag-and-drop widget reordering.

Requirements:

* Desktop drag-and-drop
* Keyboard-accessible reordering
* Mobile-compatible move controls
* Persisted order
* Persisted widget sizes
* Reset default layout
* Cancel unsaved changes
* Save layout
* Clear visual drop indicators

Do not rely only on mouse dragging.

Use the existing UI library or add one compatible maintained dependency when necessary.

Add frontend tests for:

* Reordering
* Saving
* Reload persistence
* Resetting
* Keyboard movement

---

# 53. DASHBOARD DATE RANGE

Support:

* Today
* Last 7 days
* This week
* Last 30 days
* This month
* Last 90 days
* This year
* All time
* Custom

Date selection should update relevant widgets consistently.

---

# 54. APPLICATION ACTIVITY CHART

Implement one configurable chart.

Chart types:

* Line
* Bar

Grouping:

* Day
* Week
* Month

Metrics:

* Applications
* Interviews scheduled
* Interviews completed
* Rejections
* Follow-ups sent
* Follow-ups completed
* Networking contacts
* Offers

Support multiple selected metrics.

---

# 55. JOB FUNNEL

Funnel stages:

* Applied
* Assessment
* Recruiter Screen
* Interview
* Final Interview
* Offer
* Accepted

Display:

* Count
* Percentage of total
* Conversion from previous stage
* Drop-off

Display Rejected, Ghosted, Withdrawn, and Position Closed separately as outcomes.

Filters:

* Date range
* Source
* Resume
* Job title
* Work arrangement
* User for managers

---

# 56. SOURCE ANALYTICS

Track:

* LinkedIn
* Indeed
* Jobright
* Company Website
* Recruiter
* Referral
* Networking
* University Portal
* Other

Display:

* Applications
* Responses
* Interviews
* Offers
* Rejections
* Conversion rates

Clicking a source filters the application list.

---

# 57. SAVED FILTERS AND VIEWS

Users can save:

* Name
* Filters
* Sorting
* Visible columns
* Default flag

Examples:

* Applied This Week
* Follow-Up Overdue
* Upcoming Interviews
* High Priority
* Waiting More Than 14 Days
* Remote QA
* Resume v4
* Pinned

Saved views are user-owned.

Managers maintain separate manager saved views.

---

# 58. PINNING, FLAGS, AND TAGS

Support:

* Pinned
* Important
* Favorite
* Custom tags

Pinned applications appear:

* At top of list
* Dashboard widget
* Upcoming actions when applicable

Tags are owner-scoped.

Provide tag creation, rename, archive, restore, and filtering.

---

# 59. ARCHIVE AND RESTORE

Applications can be:

* Active
* Archived
* Restored

Archived applications:

* Remain in analytics
* Remain exportable
* Retain related records
* Are hidden from active lists by default

Permanent deletion is separate and confirmed.

---

# 60. CSV EXPORT

Regular users can export their records.

Managers can export:

* All users
* Selected user
* Current filtered results

Support CSV exports for:

* Applications
* Interviews
* Rejections
* Follow-ups
* Networking contacts
* Resume analytics
* Goal history
* Aging report
* Stage-duration report
* Reminder list

Respect filters.

Do not export authentication secrets.

---

# 61. JSON EXPORT

Support full versioned JSON export.

Include:

* Profile excluding secrets
* Applications
* Timeline events
* Stage history
* Interviews
* Rejections
* Follow-ups
* Networking
* Resumes
* Reminders
* Reminder categories
* Goals
* Goal history
* Dashboard preferences
* Saved views
* Tags

Use:

```json
{
  "export_version": 1,
  "exported_at": "ISO-8601 timestamp",
  "data": {}
}
```

---

# 62. MANAGER DASHBOARD

Display:

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
* Interviews
* Overdue follow-ups
* Rejections
* Offers
* Acceptances
* Goal progress
* Goal achieved-versus-missed comparison
* Aging summary
* Stage-duration summary
* Reminder summary
* Recent imports
* Recent activity

Allow selected-user scope without impersonation.

---

# 63. USER MANAGEMENT

Manager-only page with:

* User
* Username
* Name
* Email
* Phone
* Role
* Status
* Registration date
* Application count
* Interview count
* Follow-up count
* Last activity

Actions:

* Activate
* Deactivate
* Promote
* Demote

Safeguards:

* Do not remove the only manager.
* Do not deactivate the only manager.
* Public users cannot register as managers.

---

# 64. NAVIGATION

Public:

* Login
* Register

User:

* Dashboard
* Applications
* Add Application
* Quick Add
* Bulk Import
* Calendar
* Reminder Center
* Interviews
* Rejections
* Follow-Ups
* Networking
* Resumes
* Goal Settings
* Goal History
* Aging Report
* Stage Analytics
* Exports
* Profile
* Settings

Manager:

* Manager Dashboard
* User Management
* All Applications
* All Interviews
* All Rejections
* All Follow-Ups
* All Networking
* All Resumes
* Goal Comparison
* Reminder Overview
* Import History
* Audit History

---

# 65. DATABASE MIGRATIONS

Use the existing migration system.

Do not create tables at runtime instead of migrations.

Preserve:

* Users
* User IDs
* Credentials
* Roles
* Status
* Existing job-search data

Add appropriate:

* Tables
* Foreign keys
* Unique constraints
* Indexes
* Timestamps

Test migrations on:

1. Existing development database
2. Clean database

Do not drop old tables blindly.

---

# 66. TESTING REQUIREMENTS

Add complete tests for:

## Authentication

* Existing login
* Existing registration
* Multi-user registration
* Manager login
* Lockout
* No public manager registration

## Ownership

* Cross-user application denial
* Cross-user timeline denial
* Cross-user resume denial
* Cross-user reminder denial
* Cross-user export denial
* Related-record validation
* Bulk owner spoofing denial

## Applications

* Create
* Quick Add
* Update
* Stage change
* Archive
* Restore
* Delete
* Search
* Sort
* Pagination
* Saved views
* Tags
* Pinning

## Timeline

* Automatic events
* Manual events
* Filters
* Stage history
* CSV export
* JSON export
* Filtered export
* Cross-user denial

## Resume Tracker

* CRUD
* Linking
* Archive
* Analytics
* Ownership

## Bulk Import

* JSON
* Structured text
* Preview
* No preview persistence
* Valid rows only
* All or nothing
* Duplicate actions
* Import history

## Trackers

* Interviews
* Rejections
* Follow-ups
* Networking

## Reminders

* Categories
* Custom category CRUD
* Filtering
* Snooze
* Complete
* Related-record navigation
* Category reassignment
* Ownership

## Goals

* Settings
* Target snapshots
* Progress
* History
* Trends
* Achieved versus missed
* Streaks
* Manager comparison
* Ownership

## Calendar

* Month
* Week
* Agenda
* Filters
* Related-record opening
* Ownership

## Analytics

* Funnel
* Activity chart
* Aging
* Stage duration
* Source analytics
* Resume analytics
* Empty data
* Divide-by-zero

## Dashboard Configuration

* Enable widget
* Disable widget
* Reorder widget
* Keyboard reorder
* Mobile move controls
* Resize
* Save layout
* Reload persistence
* Reset layout
* Separate manager layout
* Ownership

## Export

* CSV
* JSON
* Filtered scope
* Manager scope
* Timeline-specific export
* Secret exclusion

## End-to-End

Test a complete flow:

1. Register
2. Log in
3. Configure goals
4. Add resume
5. Add application
6. View timeline
7. Add manual event
8. Bulk import
9. Create follow-up
10. Create reminder category
11. View calendar
12. Reorder dashboard
13. Export timeline
14. View aging report
15. View goal comparison
16. Manager views user data

---

# 67. IMPLEMENTATION ORDER

Implement in this order:

1. Inspect project.
2. Inspect or initialize Git.
3. Create baseline commit if needed.
4. Create/switch to `development`.
5. Run baseline checks.
6. Preserve authentication.
7. Enable multi-user registration.
8. Add ownership enforcement.
9. Add migrations and central data models.
10. Add theme system.
11. Add applications and Quick Add.
12. Add clickable details page.
13. Add timeline and stage history.
14. Add timeline exports.
15. Add resume tracker.
16. Add bulk import.
17. Add interviews and rejections.
18. Add follow-ups.
19. Add reminder categories.
20. Add Reminder Center.
21. Add networking.
22. Add Calendar.
23. Add goal settings and snapshots.
24. Add goal history and comparison.
25. Add aging and stage analytics.
26. Add dashboard widgets.
27. Add complete widget configuration.
28. Add widget reordering.
29. Add source and resume analytics.
30. Add saved views, tags, pinning, archive.
31. Add general exports.
32. Add manager views.
33. Add tests.
34. Add/update CI.
35. Run all checks.
36. Fix every required failure.
37. Push `development`.
38. Confirm development CI passes.
39. Review complete diff.
40. Merge only when every mandatory feature is complete.
41. Run post-merge validation.
42. Push `main`.
43. Confirm main CI passes.
44. Update documentation.
45. Report final status.

---

# 68. COMPLETENESS RULE

Do not describe these features as future work:

* Configurable dashboard widgets
* Dashboard widget reordering
* Reminder categories
* Reminder category management
* Goal achieved-versus-missed comparison
* Application timeline CSV export
* Application timeline JSON export

They must be fully implemented, tested, documented, and included in CI validation.

Do not merge into `main` while any of them are incomplete.

---

# 69. FINAL MERGE GATE

Merge `development` into `main` only when:

* All mandatory database migrations succeed.
* Authentication remains functional.
* User isolation tests pass.
* Manager authorization tests pass.
* All mandatory features are implemented.
* Backend tests pass.
* Frontend tests pass.
* Integration tests pass.
* Type checking passes.
* Lint passes.
* Production build passes.
* End-to-end tests pass when infrastructure is available.
* Development branch CI passes.
* No secrets are committed.
* Git working tree is clean.
* The full diff has been reviewed.

If any gate fails:

* Do not merge.
* Leave changes on `development`.
* Push the corrected development state when possible.
* Report the blocker precisely.

---

# 70. FINAL RESPONSE FORMAT

Provide:

## Repository Assessment

* Stack
* Authentication
* Database
* Migration system
* Test setup
* Existing Git and CI state

## Git Workflow

* Initial branch
* Development branch
* Main branch
* Remote
* Commits
* Push results
* Pull request or merge method
* Main merge status

## Changes Implemented

Group by:

* Authentication
* Ownership
* Theme
* Applications
* Timeline
* Timeline export
* Resume Tracker
* Bulk import
* Interviews
* Rejections
* Follow-ups
* Reminder categories
* Reminder Center
* Networking
* Calendar
* Goals
* Goal comparison
* Aging
* Stage analytics
* Dashboard
* Widget configuration
* Widget reordering
* Saved views
* Exports
* Manager features
* Tests
* CI
* Documentation

## Files Changed

List:

* Created
* Modified
* Renamed
* Removed

## Database Migrations

Explain:

* Migration names
* Tables
* Fields
* Constraints
* Indexes
* Data preservation
* Old-table handling
* Clean-database verification
* Existing-database verification

## Security Verification

Explain:

* User isolation
* Owner spoofing prevention
* Related-record validation
* Manager authorization
* Export authorization
* Timeline authorization
* Dashboard-preference isolation
* Reminder-category isolation
* Secret protection

## Test and Build Results

Provide exact commands and results for:

* Dependency installation
* Database preparation
* Migration
* Migration status
* Backend tests
* Frontend tests
* Integration tests
* End-to-end tests
* Lint
* Type checking
* Production build
* Local CI-equivalent checks
* Remote CI

## Git Commits

List:

* Commit hash
* Message
* Purpose

## CI Results

Include:

* Development CI result
* Main CI result
* Failed jobs
* Retried jobs
* Final status

## Remaining Issues

List only genuine remaining blockers or limitations.

Do not claim incomplete features are complete.

## Final Status

Use exactly one:

* Complete, tested, merged, and published
* Complete and tested on development; main merge blocked
* Partially complete; not merged

The completed project must be a secure, fully implemented JobSearch Manager and Job Application Tracker with complete manual and bulk application entry, visual application timelines, resume tracking, follow-ups, reminder categories, calendar views, goals, goal comparisons, configurable and reorderable dashboard widgets, aging and stage analytics, dedicated timeline exports, general exports, manager visibility, Git history, CI validation, and a test-gated merge from `development` to `main`.
