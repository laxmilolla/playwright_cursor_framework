# How the JSON-Driven Framework Works

This doc explains how the object repository, test data, and tests fit together so you can change the UI or scenarios without touching test code.

---

## 1. Big picture

- **Test code** never uses raw selectors (e.g. `page.getByRole('button', { name: 'Create a Data Submission' })`). It uses **logical names** like `createDataSubmissionButton`.
- **Where those names are defined:** `Tests/data/objects.json` (object repository). Each row = one UI element: logical name + how to find it (selector type + value).
- **Scenario inputs** (e.g. what to search, what to expect): `Tests/data/test-cases.json`. One row per scenario (DS1, DS2, …).
- **Framework code** reads the JSON and turns object names into Playwright locators, and test-case IDs into data. So: **you change JSON → tests stay the same.**

---

## 2. Object repository (`Tests/data/objects.json`)

Each object is one row with:

| Field           | Meaning |
|----------------|--------|
| **objectName** | Logical name the test uses (e.g. `createDataSubmissionButton`). |
| **page**       | Which page/screen (for your reference). |
| **selectorType** | How Playwright finds it: `heading`, `role+name`, `text`, `button`, `input`, `dropdown`. |
| **selectorValue** | The value for that type (see below). |
| **notes**      | Optional description. |

**How `selectorType` is used** (in `Tests/framework/object-repo.ts`):

- **`heading`** → `page.getByRole('heading', { name: selectorValue, level: 1 })`
- **`role+name`** → `selectorValue` is `"role:Name"` (e.g. `"button:Create a Data Submission"`) → `page.getByRole(role, { name })`
- **`text`** → `page.getByText(selectorValue).first()`
- **`button`** → `page.getByRole('button', { name: RegExp(selectorValue) })`
- **`input`** / **`dropdown`** → `page.getByLabel(selectorValue)`

**Example from your file:**

```json
{"objectName": "createDataSubmissionButton", "selectorType": "role+name", "selectorValue": "button:Create a Data Submission", ...}
```

So when the test says `getLocator(page, 'createDataSubmissionButton')`, the framework looks up that row and returns `page.getByRole('button', { name: 'Create a Data Submission' })`.

**When devs change the UI** (e.g. button text becomes "New Data Submission"): you only change `selectorValue` in that row in `objects.json`. The test code does not change.

---

## 3. Test cases (`Tests/data/test-cases.json`)

Each row = one scenario (DS1, DS2, …) with the **data** for that scenario:

| Field              | Meaning |
|--------------------|--------|
| **scenarioId**     | e.g. `DS1`, `DS2`. |
| **filterType**     | Which filter (e.g. "Submission Name", "Program"). |
| **filterValue**    | Value to type or select (e.g. "auto", "GCTest-1"). |
| **expectedInColumn** | Which table column to check. |
| **expectedVisible**  | Should the result be visible (true/false). |
| **notes**          | Short description. |

**Example:** DS1 is “navigate only,” so filter fields are empty. DS2 has `filterType: "Submission Name"`, `filterValue: "auto"` for the search.

The test code can call `getTestCase('DS1')` or `getTestCase('DS2')` to get that row and then drive the test (what to type, what to assert) from it. So **adding or changing a scenario** = add or edit a row in `test-cases.json`; the same test logic can run for all rows.

---

## 4. How a test uses it (example: DS1)

**File:** `Tests/DS1.spec.ts`

1. **Base URL** comes from the environment: `process.env.BASE_URL` (e.g. from `.env`), with a fallback. So the same test can run against different envs.
2. **Steps:** go to hub → login → go to `/data-submissions`.
3. **Assertions** use **object names only**:
   - `getLocator(page, 'dataSubmissionsPageTitle')` → from objects.json: heading "Data Submissions".
   - `getLocator(page, 'createDataSubmissionButton')` → button "Create a Data Submission".
   - `getLocator(page, 'tableColumnSubmissionName')` → text "Submission Name".

So the spec has **no strings like "Data Submissions" or "Create a Data Submission"**; they all live in `objects.json`. Change the UI → change the JSON → test code stays the same.

---

## 5. Flow diagram (simplified)

```
┌─────────────────────┐     ┌──────────────────────────┐
│ objects.json        │     │ test-cases.json           │
│ (objectName →       │     │ (scenarioId → filterType,  │
│  selectorType,      │     │  filterValue, expected…)   │
│  selectorValue)     │     │                            │
└─────────┬───────────┘     └─────────────┬──────────────┘
          │                                │
          ▼                                ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ object-repo.ts      │     │ test-data.ts             │
│ getLocator(page,    │     │ getTestCase('DS1')        │
│  objectName)        │     │ loadTestCases()          │
└─────────┬───────────┘     └─────────────┬──────────────┘
          │                                │
          └────────────┬───────────────────┘
                       ▼
          ┌────────────────────────────┐
          │ DS1.spec.ts                │
          │ (and other specs)          │
          │ Uses names + test case    │
          │ data only; no raw selectors│
          └────────────────────────────┘
```

---


## 6. Summary

| What you want to do              | Where you change it                    |
|----------------------------------|----------------------------------------|
| Change a button/label/selector   | `Tests/data/objects.json` (that object’s row) |
| Add or change a scenario (e.g. DS2) | `Tests/data/test-cases.json` (one row per scenario) |
| Change environment (stage/prod)  | `.env` (`BASE_URL`)                     |
| Change test flow/steps           | The spec file (e.g. `DS1.spec.ts`) |

The test code stays stable; you maintain the app and scenarios in JSON and env.
