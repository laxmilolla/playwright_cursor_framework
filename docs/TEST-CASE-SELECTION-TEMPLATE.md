# Test Case Selection Template

Use this when the agent generates test cases from a user story. The user picks which cases to automate via the **HTML form**, then pastes the selection in chat. The agent generates Playwright only for those.

## File

- **HTML template:** `tools/test-case-selection-template.html` — Open in a browser. First column is a **clickable checkbox** (button-like). User checks the test cases they want, clicks **Copy selection**, then pastes the result (e.g. `1, 2, 4`) in Cursor. Agent uses that list.

## Columns (in the HTML table)

| Column   | Purpose |
|----------|---------|
| Include? | Checkbox to select for automation. |
| #        | Row number (1, 2, 3…). |
| Scenario ID | e.g. DS1, DS2 (for mapping to spec names). |
| Summary  | One-line test case title. |
| Preconditions | What must be true before. |
| Steps    | Numbered steps. |
| Expected result | What should happen. |

## Agent flow

1. From the user story (and optional codegen/screenshot), generate real test cases: Scenario ID, Summary, Preconditions, Steps, Expected result.
2. Generate HTML with the same table structure (or point the user to the template). User opens it in a browser, checks the boxes for the test cases they want, clicks **Copy selection**, and pastes (e.g. `1, 2, 4`) in the chat.
3. Use those numbers (or Scenario IDs) to select which scenarios to generate.
4. Generate Playwright specs + `objects.json` + `test-cases.json` only for the selected scenarios.

If the user doesn’t use the form and instead replies with numbers (e.g. "1, 2, 4"), use that list directly.

## Notes

- Scenario ID must match the naming used in specs (e.g. DS1, DS2) and in `test-cases.json` (`scenarioId`).
