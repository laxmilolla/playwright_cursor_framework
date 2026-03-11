# Data Submissions – Test Scenarios

This document defines user stories, scenarios, and test coverage for the **Data Submissions** page (`/data-submissions`) on the CRDC Hub. Use it to implement Playwright tests and to drive the Excel object repository and test-case data.

---

## Page Overview

- **URL:** `hub-stage.datacommons.cancer.gov/data-submissions` (base URL from env)
- **Title:** Data Submissions
- **Description:** "Below is a list of data submissions that are associated with your account. Please click on any of the data submissions to review or continue work."
- **Main action:** Create a Data Submission (button, top right)
- **Filters:** Program, Status, Data Commons, Submission Name, dbGaP ID, Submitter; Refresh/Reset (circular arrow)
- **Table columns:** Submission Name, Submitter, Data Commons, Type, Model Version, Program, Study, dbGaP ID, Status, Data Concierge, Record Count, Created Date, Last Updated

---

## User Stories

1. **As a user, I can open the Data Submissions page** so that I see the list of submissions and filters.
2. **As a user, I can filter submissions by Submission Name** (min 3 characters) so that the table shows only matching rows.
3. **As a user, I can filter by Program** so that I see submissions for a selected program.
4. **As a user, I can filter by Status** so that I see only submissions in selected statuses.
5. **As a user, I can filter by Data Commons** so that I narrow by commons (e.g. GC, CTDC).
6. **As a user, I can filter by Submitter** so that I see only my or a chosen submitter's submissions.
7. **As a user, I can filter by dbGaP ID** (min 3 characters) so that I find submissions by study ID.
8. **As a user, I can refresh/reset filters** so that I clear filters and see the full list again.
9. **As a user, I can see that the table updates** when I apply filters so that the results match the selected criteria.

---

## Scenarios and Tests

| ID   | Scenario                      | What the test does |
|------|-------------------------------|--------------------|
| **DS1**  | Navigate to Data Submissions  | Go to `/data-submissions`, assert page title "Data Submissions", assert "Create a Data Submission" visible, assert table (or table headers) visible. |
| **DS2**  | Filter by Submission Name     | Fill "Submission Name" with a known value (e.g. "auto"), apply (Enter or Apply), assert table shows only rows containing that text in Submission Name (or at least one such row). |
| **DS3**  | Filter by Program             | Open Program dropdown, select a value (e.g. "GCTest-1"), assert URL or table updates, assert visible rows match selected program (or count > 0). |
| **DS4**  | Filter by Status              | Open Status dropdown, select one or more statuses (e.g. "In Progress"), assert table only shows those statuses in the Status column. |
| **DS5**  | Filter by Data Commons        | Select a Data Commons (e.g. "CTDC"), assert table rows show that commons. |
| **DS6**  | Filter by Submitter           | Select a submitter from dropdown, assert table shows only that submitter (or matching rows). |
| **DS7**  | Filter by dbGaP ID            | Fill dbGaP ID with min 3 chars (e.g. "phs"), apply, assert table shows matching dbGaP IDs (or at least one row). |
| **DS8**  | Reset/refresh filters         | Apply one or more filters, click the refresh/reset (circular arrow) button, assert filters are cleared and table returns to unfiltered (e.g. more rows or default state). |
| **DS9**  | Combined filters              | Set Program + Status (or Name + Status), assert table reflects both (e.g. only "In Progress" and selected program). |
| **DS10** | Submission Name min 3 chars   | Try 1–2 characters, assert validation message or that filter doesn't apply; use 3+ chars and assert filter works. |

---

## Excel Object Repository (Objects Sheet)

Use these logical names in the Objects sheet so tests and auth-helpers use `getLocator(page, objectName)` instead of hardcoded selectors. When devs change the UI, update only the Excel row.

| objectName                  | page           | selectorType | selectorValue (example)                          | notes                    |
|----------------------------|----------------|--------------|---------------------------------------------------|--------------------------|
| dataSubmissionsPageTitle   | Data Submissions | text       | Data Submissions                                  | Page heading             |
| createDataSubmissionButton | Data Submissions | role+name   | button:Create a Data Submission                   | Top right CTA            |
| filterProgram              | Data Submissions | (dropdown)  | Program filter                                    | Row 1                    |
| filterStatus               | Data Submissions | (dropdown)  | Status filter                                     | Row 1                    |
| filterDataCommons          | Data Submissions | (dropdown)  | Data Commons filter                               | Row 1                    |
| filterRefreshResetButton   | Data Submissions | (button/icon)| Refresh or Reset                                  | Circular arrow, Row 1     |
| filterSubmissionName       | Data Submissions | (input)     | Submission Name, placeholder min 3 chars          | Row 2                    |
| filterDbGaPId              | Data Submissions | (input)     | dbGaP ID, placeholder min 3 chars                  | Row 2                    |
| filterSubmitter            | Data Submissions | (dropdown)  | Submitter filter                                  | Row 2                    |
| submissionsTable           | Data Submissions | (table/grid)| Table or container for submissions grid           | Main content             |
| tableColumnSubmissionName  | Data Submissions | (column)    | Submission Name column                            | For row assertions       |
| tableColumnStatus          | Data Submissions | (column)    | Status column                                     | For row assertions       |
| tableColumnProgram         | Data Submissions | (column)    | Program column                                    | For row assertions       |
| tableColumnDataCommons     | Data Submissions | (column)    | Data Commons column                               | For row assertions       |
| tableColumnSubmitter       | Data Submissions | (column)    | Submitter column                                  | For row assertions       |
| tableColumnDbGaPId         | Data Submissions | (column)    | dbGaP ID column                                   | For row assertions       |

*Note:* Actual `selectorType` and `selectorValue` should be filled once real selectors (role+name, testId, label, etc.) are known from the app.

---

## Excel Test Data (Test Cases Sheet)

Use one row per scenario (or one row per data-driven run). Columns can be extended per need.

| scenarioId | filterType       | filterValue  | expectedInColumn   | expectedVisible | notes              |
|------------|------------------|--------------|--------------------|-----------------|--------------------|
| DS1        | —                | —            | —                  | —               | Navigate only      |
| DS2        | Submission Name  | auto         | Submission Name    | true            | Text filter        |
| DS3        | Program          | GCTest-1     | Program            | true            | Dropdown           |
| DS4        | Status           | In Progress  | Status             | true            | Dropdown           |
| DS5        | Data Commons     | CTDC         | Data Commons       | true            | Dropdown           |
| DS6        | Submitter        | (value TBD)  | Submitter          | true            | Dropdown           |
| DS7        | dbGaP ID         | phs          | dbGaP ID           | true            | Min 3 chars        |
| DS8        | reset            | —            | —                  | —               | Refresh/Reset      |
| DS9        | Program,Status   | GCTest-1,In Progress | Program,Status | true | Combined filters   |
| DS10a      | Submission Name  | ab           | —                  | false           | Validation &lt; 3 chars |
| DS10b      | Submission Name  | abc          | Submission Name    | true            | Validation ≥ 3 chars |

---

## Implementation Order

1. **DS1** – Navigate and basic visibility (title, Create button, table).
2. **DS2** – Submission Name filter (simple text filter, easy to assert).
3. **DS8** – Reset filters (reuse session for multiple filter tests).
4. **DS3–DS7, DS9, DS10** – Remaining filter and validation scenarios.

---

## Framework (DS1 and beyond)

- **Object repository:** `Tests/data/objects.json` — logical names and selectors (objectName, selectorType, selectorValue). Tests use `getLocator(page, objectName)` from `Tests/framework/object-repo.ts`.
- **Test cases:** `Tests/data/test-cases.json` — one row per scenario (scenarioId, filterType, filterValue, etc.). Use `getTestCase('DS1')` from `Tests/framework/test-data.ts` for data-driven tests.
- **DS1** is implemented in `Tests/DS1.spec.ts` using the framework (no hardcoded selectors; BASE_URL from `.env`).

## References

- Auth and login: `Tests/auth-helpers.ts`
- Existing submission flow: `Tests/submission.spec.ts` (Submission Requests search)
- Base URL and credentials: `.env` (use `BASE_URL` for environment-specific URL)
