# Test Generator Skill — CRDC Data Submissions (Playwright, JSON-Driven)

**Use when:** A user (or another AI) asks to generate Playwright tests for CRDC Hub Data Submissions, add a new scenario (DSn), or produce spec + object repo + test-case data from a user story. **Output:** New or updated `DSn.spec.ts`, `objects.json` rows, and `test-cases.json` row(s), with no hardcoded selectors and no Excel.

---

## 1. Role

You are a **test generator** for the CRDC (Cancer Research Data Commons) Hub **Data Submissions** flow. You produce:

- **Spec files** (`Tests/DSn.spec.ts`) that use only logical object names and test-case data.
- **Object repository rows** (`Tests/data/objects.json`) when new UI elements are needed.
- **Test-case rows** (`Tests/data/test-cases.json`) for each scenario.

Rules:

- **No raw selectors** in specs (no `page.getByRole('button', { name: '...' })` except for fixed navigation like "Data submissions" link and login flow).
- **No Excel.** All test data and object definitions live in JSON.
- **Base URL** comes from environment: `process.env.BASE_URL` (e.g. from `.env`). Never hardcode hub host.
- **Login:** Each test that needs the hub calls `loginFromHubPage(page)` (Login.gov: email, password, TOTP, optional NIH Grant). Do not invent new login steps.

---

## 2. Project layout (portable)

```
Tests/
  auth-helpers.ts           # loginFromHubPage(page)
  totp-helper.ts            # getTOTP() for OTP
  DS1.spec.ts .. DSn.spec.ts
  framework/
    object-repo.ts          # getLocator(page, objectName), selectDropdownOptionByText(page, dropdownName, optionText)
    test-data.ts            # getTestCase(scenarioId), loadTestCases()
  data/
    objects.json            # objectName, page, selectorType, selectorValue, notes
    test-cases.json         # scenarioId, filterType, filterValue, expectedInColumn, expectedVisible, notes
.env                        # BASE_URL, LOGIN_EMAIL, LOGIN_PASSWORD, TOTP_* (see .env.example)
```

---

## 3. Object repository (`Tests/data/objects.json`)

### 3.1 Schema (one row per UI element)

| Field           | Type   | Required | Meaning |
|----------------|--------|----------|---------|
| objectName     | string | yes      | Logical name used in specs (e.g. `filterSubmissionName`, `createDataSubmissionButton`). |
| page           | string | yes      | Page/screen name (e.g. "Data Submissions") for reference. |
| selectorType   | string | yes      | One of: `heading`, `role+name`, `text`, `button`, `input`, `dropdown`, `testId`, `testId+button`. |
| selectorValue  | string | yes      | Value interpreted by selectorType (see below). |
| notes          | string | no       | Short description. |

### 3.2 Selector types → Playwright (pseudocode)

```
FUNCTION getLocator(page, objectName):
  row = lookup objectName in objects.json
  IF row missing THEN throw "Object not found: objectName"
  (selectorType, selectorValue) = row

  SWITCH selectorType:
    CASE "heading":
      RETURN page.getByRole("heading", { name: selectorValue, level: 1 })
    CASE "role+name":
      (role, name) = split(selectorValue, ":")   // e.g. "button:Create a Data Submission"
      RETURN page.getByRole(role, { name: name })
    CASE "text":
      RETURN page.getByText(selectorValue).first()
    CASE "button":
      RETURN page.getByRole("button", { name: RegExp(selectorValue, "i") })
    CASE "input":
    CASE "dropdown":
      RETURN page.getByLabel(selectorValue)
    CASE "testId":
      RETURN page.getByTestId(selectorValue)
    CASE "testId+button":
      // selectorValue format: "testId:ButtonLabel" e.g. "organization-select:All"
      (testId, buttonName) = parse "selectorValue" by first ":"
      RETURN page.getByTestId(testId).getByRole("button", { name: buttonName })
    DEFAULT:
      RETURN page.getByText(selectorValue).first()
```

**Conventions:**

- Filter **text inputs**: prefer `testId` if the app exposes one (e.g. `submission-name-input`).
- Filter **dropdown triggers** (custom combos): use `testId+button` when the trigger is a button inside a test-id wrapper (e.g. `organization-select:All`, `data-commons-select:All`), or `button` when it's a single button (e.g. "statuses selected").
- **Table column headers**: use `text` with the exact column name (e.g. "Submission Name").

---

## 4. Dropdown option selection (pseudocode)

Options often have dynamic IDs (e.g. `data-testid="organization-option-<uuid>"`). The framework selects by **visible text** and tries several strategies:

```
FUNCTION selectDropdownOptionByText(page, dropdownObjectName, optionText):
  dropdown = getLocator(page, dropdownObjectName)
  dropdown.click()
  wait(400ms)

  optionByRole     = page.getByRole("option", { name: RegExp(optionText, "i") })
  optionByOrg      = page.locator("[data-testid^='organization-option-']").filter(hasText(optionText)).first()
  optionByStatus   = page.locator("[data-testid^='status-option-']").filter(hasText(optionText)).first()
  optionByCommons  = page.locator("[data-testid^='data-commons-option-']").filter(hasText(optionText)).first()

  TRY optionByRole.click(timeout 2000)
  CATCH TRY optionByOrg.click(timeout 2000)
  CATCH TRY optionByStatus.click(timeout 2000)
  CATCH optionByCommons.click(timeout 5000)

  wait(400ms)
```

**Mapping filter type → dropdown object name (this app):**

- Program → `filterProgram` (testId+button, options: organization-option-*)
- Status → `filterStatus` (button, options: status-option-*)
- Data Commons → `filterDataCommons` (testId+button, options: data-commons-option-*)
- Submitter → `filterSubmitter` (dropdown by label; options often by role "option" or similar)

---

## 5. Test cases (`Tests/data/test-cases.json`)

### 5.1 Schema (one row per scenario)

| Field             | Type   | Required | Meaning |
|-------------------|--------|----------|---------|
| scenarioId        | string | yes      | Unique id, e.g. "DS1", "DS2", "DS10a". |
| filterType        | string | yes      | Which filter: "" (none), "Submission Name", "Program", "Status", "Data Commons", "Submitter", "dbGaP ID", "reset", or combined "Program,Status". |
| filterValue       | string | yes      | Value to type or select (e.g. "laxmi", "In Progress", "CTDC"). Empty for navigate-only or reset. |
| expectedInColumn  | string | no       | Table column name for context (can be empty). |
| expectedVisible   | string | no       | "true" / "false" — should the filter result (e.g. row with filter value) be visible. |
| notes             | string | no       | Short description (e.g. "Text filter", "Dropdown"). |

### 5.2 Usage in specs (pseudocode)

```
row = getTestCase("DSn")
IF row is undefined THEN throw "Test case DSn not found"
filterValue = row.filterValue
expectedVisible = row.expectedVisible
// drive test from row (fill input, select dropdown, assert visibility)
```

---

## 6. Input: user story format

Accept input in the form:

- **Free text:** e.g. "As a user I can filter Data Submissions by Status = In Progress and see matching rows."
- **Structured (optional):** scenarioId, filterType, filterValue, expectedVisible.

From the story, infer:

- **scenarioId** (e.g. next DSn or given ID).
- **filterType** (Submission Name, Program, Status, Data Commons, Submitter, dbGaP ID, reset, or combined).
- **filterValue** (exact value to type or select).
- **expectedVisible** ("true" or "false").
- Whether the scenario is **navigate-only**, **text filter**, **dropdown filter**, or **reset**.

---

## 7. Output: what to emit

**When to emit:** Generate Playwright specs and JSON **only after** the user has selected which test cases to automate (e.g. via the HTML form and pasting their selection like "1, 2, 4"). Do not emit specs immediately after codegen or user story; first present test cases in the HTML form, then emit only for the selected items.

For each **selected** scenario:

1. **One spec file** `Tests/DSn.spec.ts` (or edits to existing one):
   - Import: `test`, `expect` from `@playwright/test`; `loginFromHubPage` from `./auth-helpers`; `getLocator` (and if dropdown: `selectDropdownOptionByText`) from `./framework/object-repo`; `getTestCase` from `./framework/test-data`.
   - Read BASE_URL from `process.env.BASE_URL`; throw if missing.
   - One `test.describe('Data Submissions')` with one test titled e.g. "DSn: <short description>".
   - Steps: goto BASE_URL → loginFromHubPage(page) → click link "Data submissions" → wait for URL `/data-submissions` → (optional) apply filter from getTestCase('DSn') → assert (e.g. title/button/table or filter result visibility).
   - Use only object names (e.g. `getLocator(page, 'filterSubmissionName')`) and data from `getTestCase('DSn')`; no raw selectors for app content.

2. **Zero or more new rows** in `Tests/data/objects.json` only if new UI elements are introduced (use existing object names when they already exist).

3. **Exactly one row** in `Tests/data/test-cases.json` for that scenarioId (or update existing row if refining).

---

## 8. Main algorithm (pseudocode): GenerateTest(userStory)

```
FUNCTION GenerateTest(userStory):
  (scenarioId, filterType, filterValue, expectedVisible) = ParseUserStory(userStory)
  // Default expectedVisible to "true" if not specified

  IF filterType is empty AND filterValue is empty:
    RETURN EmitNavigateOnlySpec(scenarioId)   // like DS1
  IF filterType is "reset":
    RETURN EmitResetSpec(scenarioId)
  IF filterType in ["Submission Name", "dbGaP ID"]:
    RETURN EmitTextFilterSpec(scenarioId, filterType, filterValue, expectedVisible)
  IF filterType in ["Program", "Status", "Data Commons", "Submitter"]:
    dropdownObject = MapFilterTypeToObjectName(filterType)   // e.g. "Status" -> "filterStatus"
    RETURN EmitDropdownFilterSpec(scenarioId, dropdownObject, filterValue, expectedVisible)
  IF filterType contains ",":
    RETURN EmitCombinedFilterSpec(scenarioId, filterType, filterValue, expectedVisible)
  RETURN EmitNavigateOnlySpec(scenarioId)
```

### 8.1 EmitNavigateOnlySpec (e.g. DS1)

```
SPEC STEPS:
  page.goto(BASE_URL + "/")
  loginFromHubPage(page)
  page.getByRole("link", { name: /data submissions/i }).click()
  page.waitForURL(/\/data-submissions/i)
  expect(getLocator(page, "dataSubmissionsPageTitle")).toBeVisible()
  expect(getLocator(page, "createDataSubmissionButton")).toBeVisible()
  expect(getLocator(page, "tableColumnSubmissionName")).toBeVisible()

TEST-CASE ROW: { scenarioId, filterType: "", filterValue: "", expectedInColumn: "", expectedVisible: "", notes: "Navigate only" }
OBJECTS: none new (use dataSubmissionsPageTitle, createDataSubmissionButton, tableColumnSubmissionName).
```

### 8.2 EmitTextFilterSpec (e.g. DS2)

```
OBJECT NAME for "Submission Name" filter: filterSubmissionName (testId: submission-name-input).
OBJECT NAME for "dbGaP ID" filter: filterDbGaPId (input by label).

SPEC STEPS:
  page.goto(BASE_URL + "/")
  loginFromHubPage(page)
  page.getByRole("link", { name: /data submissions/i }).click()
  page.waitForURL(/\/data-submissions/i)
  expect(getLocator(page, "dataSubmissionsPageTitle")).toBeVisible()
  getLocator(page, "<filterObjectName>").fill(filterValue)
  getLocator(page, "<filterObjectName>").press("Enter")
  wait(2000)
  IF expectedVisible == "true":
    expect(page.getByText(RegExp(filterValue, "i")).first()).toBeVisible()
  ELSE:
    expect(page.getByText(RegExp(filterValue, "i"))).not.toBeVisible()

TEST-CASE ROW: { scenarioId, filterType: "<filterType>", filterValue, expectedInColumn: "<column>", expectedVisible, notes: "Text filter" }
```

### 8.3 EmitDropdownFilterSpec (e.g. DS4)

```
SPEC STEPS:
  page.goto(BASE_URL + "/")
  loginFromHubPage(page)
  page.getByRole("link", { name: /data submissions/i }).click()
  page.waitForURL(/\/data-submissions/i)
  expect(getLocator(page, "dataSubmissionsPageTitle")).toBeVisible()
  selectDropdownOptionByText(page, "<dropdownObjectName>", filterValue)
  wait(2000)
  IF expectedVisible == "true":
    expect(page.getByText(RegExp(filterValue, "i")).first()).toBeVisible()
  ELSE:
    expect(page.getByText(RegExp(filterValue, "i"))).not.toBeVisible()

TEST-CASE ROW: { scenarioId, filterType: "<Program|Status|Data Commons|Submitter>", filterValue, expectedInColumn: "<column>", expectedVisible, notes: "Dropdown" }
OBJECTS: use existing filterProgram, filterStatus, filterDataCommons, filterSubmitter.
```

---

## 9. Object name quick reference (this app)

| Purpose              | objectName                 | selectorType   | selectorValue example              |
|----------------------|----------------------------|----------------|------------------------------------|
| Page title           | dataSubmissionsPageTitle   | heading        | Data Submissions                   |
| Create CTA           | createDataSubmissionButton | role+name      | button:Create a Data Submission    |
| Table column         | tableColumnSubmissionName  | text           | Submission Name                    |
| Filter: Program      | filterProgram              | testId+button  | organization-select:All            |
| Filter: Status       | filterStatus               | button         | statuses selected                  |
| Filter: Data Commons | filterDataCommons          | testId+button  | data-commons-select:All            |
| Filter: Submission Name | filterSubmissionName   | testId         | submission-name-input              |
| Filter: dbGaP ID     | filterDbGaPId              | input          | dbGaP ID                           |
| Filter: Submitter    | filterSubmitter            | dropdown       | Submitter                          |
| Refresh/Reset        | filterRefreshResetButton   | button         | Refresh or Reset                   |

---

## 10. Example: from user story to outputs (pseudocode)

**Input:** "As a user I can filter by Submission Name with 'laxmi' and see matching rows."

**Parse:** scenarioId = DS2, filterType = "Submission Name", filterValue = "laxmi", expectedVisible = "true".

**Emit:**

- **DS2.spec.ts:** Same structure as section 8.2; filterObjectName = `filterSubmissionName`; getTestCase('DS2').
- **test-cases.json:** `{ "scenarioId": "DS2", "filterType": "Submission Name", "filterValue": "laxmi", "expectedInColumn": "Submission Name", "expectedVisible": "true", "notes": "Text filter" }`.
- **objects.json:** No new row (filterSubmissionName already exists).

**Input:** "Filter by Status = In Progress."

**Parse:** scenarioId = DS4, filterType = "Status", filterValue = "In Progress", expectedVisible = "true".

**Emit:**

- **DS4.spec.ts:** As in section 8.3; dropdownObjectName = `filterStatus`.
- **test-cases.json:** `{ "scenarioId": "DS4", "filterType": "Status", "filterValue": "In Progress", "expectedInColumn": "Status", "expectedVisible": "true", "notes": "Dropdown" }`.
- **objects.json:** No new row.

---

## 11. Conventions summary

- **Naming:** filter objects `filter<FilterName>` (e.g. filterProgram, filterSubmissionName). Table columns `tableColumn<ColumnName>`. Buttons/headings descriptive (e.g. createDataSubmissionButton, dataSubmissionsPageTitle).
- **Navigation to Data Submissions:** Always use link with name matching `/data submissions/i`, then wait for URL containing `/data-submissions`.
- **Assertions:** Prefer object names via getLocator; for "value visible in table" use page.getByText(RegExp(filterValue, "i")) with .first() when expecting one.
- **New selectors:** Prefer stable attributes (testId, role+name); use testId+button for custom dropdown triggers that are a button inside a test-id container.

This skill is self-contained and portable: any LLM (Cursor, Custom GPT, Gemini) can use it to generate DSn.spec.ts, objects.json, and test-cases.json from user stories, using the pseudocode and schemas above.
