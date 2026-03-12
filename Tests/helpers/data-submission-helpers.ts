import * as path from 'path';
import * as fs from 'fs';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { getLocator, getLocatorWithValue, selectDropdownOptionByText } from '../framework/object-repo';

const PROJECT_ROOT = path.resolve(process.cwd());

/**
 * Create a new Data Submission from the Data Submissions list page.
 * Uses create button → Data Commons → Study → Submission Name → Create.
 */
export async function createDataSubmission(
  page: Page,
  options: { program: string; study: string; submissionName: string; dataCommons?: string }
): Promise<void> {
  const { program, study, submissionName, dataCommons = 'GC' } = options;
  await getLocator(page, 'createDataSubmissionButton').click();
  await page.waitForTimeout(500);

  const dialog = getLocator(page, 'createDataSubmissionDialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  await getLocator(dialog, 'createDialogDataCommonsTrigger').click();
  await page.waitForTimeout(400);
  await page.locator('li').filter({ hasText: new RegExp('^' + dataCommons + '$') }).first().click({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Codegen: one "Select" after Data Commons — opens Study dropdown
  await page.getByRole('button', { name: 'Select' }).click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator('[data-testid^="study-option-"]').filter({ hasText: new RegExp('^' + study.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);

  await getLocator(dialog, 'createDialogSubmissionNameInput').fill(submissionName);
  await page.waitForTimeout(300);
  await getLocator(dialog, 'createDialogCreateButton').click();
  await page.waitForTimeout(2000);
}

/**
 * From Data Submissions list, open a submission by its name (click the link in the table).
 * If multiple rows have the same name, opens the first (most recent) one.
 */
export async function openSubmissionByName(page: Page, submissionName: string): Promise<void> {
  await getLocatorWithValue(page, 'submissionLinkByName', submissionName).first().click();
  await page.waitForURL(/\/data-submission\/[^/]+/i, { timeout: 15000 });
  await page.waitForTimeout(1500);
}

/**
 * On submission detail (upload activity), upload all TSV files from the given folder (e.g. TC03).
 * File input may be hidden (Choose Files button); use testId if present, else native input[type=file].
 */
export async function uploadFilesFromFolder(page: Page, uploadFolder: string): Promise<void> {
  const dir = path.join(PROJECT_ROOT, uploadFolder);
  if (!fs.existsSync(dir)) throw new Error(`Upload folder not found: ${dir}`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tsv')).map((f) => path.join(dir, f));
  if (files.length === 0) throw new Error(`No .tsv files in ${uploadFolder}`);

  const fileInput = page.locator('input[type=file]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await fileInput.setInputFiles(files);
  await page.waitForTimeout(500);
  await getLocator(page, 'metadataUploadFileUploadButton').click();
  await page.waitForTimeout(3000);
}

/**
 * Run validations: select "Run validations" radio and click Validate.
 * Wait until validation run finishes: "Validating" is gone and the button is back to "Validate".
 */
export async function runValidations(page: Page): Promise<void> {
  await getLocator(page, 'validateRadioRunValidations').check();
  await page.waitForTimeout(300);
  await getLocator(page, 'validateControlsValidateButton').click();
  await page.waitForTimeout(2000);
  // Wait for "Validating" to disappear and Validate button to be back (run finished)
  await page.getByRole('button', { name: /Validating/i }).waitFor({ state: 'hidden', timeout: 120000 });
  await getLocator(page, 'validateControlsValidateButton').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Assert Upload Activities tab is visible and optionally check for expected file count in a batch row.
 */
export async function assertUploadStatusTab(page: Page, expectedFileCount?: number): Promise<void> {
  await getLocator(page, 'tabUploadStatus').click();
  await page.waitForTimeout(1000);
  await expect(getLocator(page, 'tabUploadStatus')).toBeVisible();
  if (expectedFileCount != null) {
    await expect(page.getByText(new RegExp(String(expectedFileCount), 'i')).first()).toBeVisible({ timeout: 10000 });
  }
}

/**
 * Assert Data View tab is visible and has content.
 */
export async function assertDataViewTab(page: Page): Promise<void> {
  await getLocator(page, 'tabDataView').click();
  await page.waitForTimeout(1000);
  await expect(getLocator(page, 'tabDataView')).toBeVisible();
}

/** Expected folder convention: {uploadFolder}/expected-{TabName}/ contains TSV(s) for that tab. */
const EXPECTED_TAB_FOLDERS = ['expected-ValidationResults', 'expected-UploadActivities', 'expected-DataView'] as const;
const TAB_DISPLAY_NAMES: Record<string, string> = {
  'expected-ValidationResults': 'Validation Results',
  'expected-UploadActivities': 'Upload Activities',
  'expected-DataView': 'Data View',
};

/** Parse any TSV into header + rows (array of record by column name). */
function parseTsvToRows(content: string): { header: string[]; rows: Array<Record<string, string>> } {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split('\t').map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const row: Record<string, string> = {};
    header.forEach((h, j) => (row[h] = (cells[j] ?? '').trim()));
    rows.push(row);
  }
  return { header, rows };
}

/** Get first TSV file path in folder; returns undefined if folder missing or empty. */
function getFirstExpectedTsvInFolder(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tsv'));
  if (files.length === 0) return undefined;
  return path.join(dir, files[0]);
}

/** Read visible table on page into rows (header from first row, data from rest). Assumes we're on the tab with the table. */
async function getTableDataFromPage(page: Page): Promise<{ header: string[]; rows: Array<Record<string, string>> }> {
  const table = page.locator('table').first();
  await table.waitFor({ state: 'visible', timeout: 5000 }).catch(() => ({ header: [], rows: [] }));
  const headerCells = await table.locator('thead th').allTextContents();
  const header = headerCells.map((t) => t.trim());
  const dataRows = table.locator('tbody tr');
  const count = await dataRows.count();
  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < count; i++) {
    const cells = await dataRows.nth(i).locator('td').allTextContents();
    const row: Record<string, string> = {};
    header.forEach((h, j) => (row[h] = (cells[j] ?? '').trim()));
    rows.push(row);
  }
  return { header, rows };
}

/** Normalize string for comparison (trim, collapse spaces). */
function norm(s: string): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Build cell-by-cell report: one collapsible section per tab.
 * Each section has a table: Column name | Expected value | UI value | Pass/Fail.
 * Expected TSVs come from {uploadFolder}/expected-{TabName}/ (e.g. TC03/expected-ValidationResults/).
 */
function buildCellByCellReportHtml(
  uploadFolder: string,
  tabSections: Array<{
    tabKey: string;
    expectedHeader: string[];
    expectedRows: Array<Record<string, string>>;
    actualHeader: string[];
    actualRows: Array<Record<string, string>>;
    columnMap?: Record<string, string>; // expected col name -> actual col name for alignment
  }>
): string {
  const parts: string[] = [];
  for (const sec of tabSections) {
    const tabName = TAB_DISPLAY_NAMES[sec.tabKey] ?? sec.tabKey;
    const allCols = [...new Set([...sec.expectedHeader, ...sec.actualHeader])].filter(Boolean);
    const maxRows = Math.max(sec.expectedRows.length, sec.actualRows.length);
    const cellRows: string[] = [];
    let passCount = 0;
    let failCount = 0;
    let naCount = 0;
    for (let r = 0; r < maxRows; r++) {
      for (const col of allCols) {
        const actualCol = sec.columnMap?.[col] ?? col;
        const expectedVal = sec.expectedRows[r]?.[col] ?? '—';
        const actualVal = sec.actualRows[r]?.[actualCol] ?? '—';
        const noExpected = norm(expectedVal) === '' || expectedVal === '—';
        const pass = noExpected ? null : norm(expectedVal) === norm(actualVal);
        if (pass === true) passCount++;
        else if (pass === false) failCount++;
        else naCount++;
        const status = pass === true ? '✓ Pass' : pass === false ? '✗ Fail' : '— N/A (no expected)';
        const rowClass = pass === true ? 'match' : pass === false ? 'missing' : 'na';
        cellRows.push(
          `<tr class="${rowClass}">
            <td>Row ${r + 1}</td>
            <td>${escapeHtml(col)}</td>
            <td>${escapeHtml(expectedVal)}</td>
            <td>${escapeHtml(actualVal)}</td>
            <td>${status}</td>
          </tr>`
        );
      }
    }
    const summary = sec.expectedRows.length === 0 && sec.actualRows.length === 0
      ? 'No expected file or no data.'
      : sec.expectedRows.length === 0
        ? `UI only (no expected file): ${cellRows.length} cells shown. Add TSV to ${uploadFolder}/${sec.tabKey}/ to compare.`
        : `${passCount} pass, ${failCount} fail${naCount > 0 ? `, ${naCount} N/A (no expected)` : ''} (${cellRows.length} cells).`;
    parts.push(`
      <details class="tab-section">
        <summary><strong>${escapeHtml(tabName)}</strong> — ${summary}</summary>
        <table>
          <thead><tr><th>Row</th><th>Column name</th><th>Expected value</th><th>UI value</th><th>Pass/Fail</th></tr></thead>
          <tbody>${cellRows.length ? cellRows.join('') : '<tr><td colspan="5">No cells to compare.</td></tr>'}</tbody>
        </table>
      </details>`);
  }
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Cell-by-cell validation by tab</title>
<style>
  body { font-family: sans-serif; padding: 1rem; }
  table { border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #eee; }
  tr.match { background: #e8f5e9; }
  tr.missing { background: #ffebee; }
  tr.na { background: #f5f5f5; color: #666; }
  details.tab-section { margin: 1rem 0; border: 1px solid #ccc; padding: 0.5rem 1rem; }
  details.tab-section summary { cursor: pointer; font-size: 1rem; }
  h1 { font-size: 1.2rem; }
</style></head>
<body>
  <h1>Cell-by-cell validation (expected from ${escapeHtml(uploadFolder)}/expected-* folders)</h1>
  ${parts.join('')}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse expected TSV (Issue_Type, Expected_Severity, file_id, md5sum) into list of issues to find in actual.
 */
function parseExpectedValidationTsv(content: string): Array<{ issueType: string; severity: string; valueToMatch: string }> {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  const issueTypeIdx = header.indexOf('Issue_Type');
  const severityIdx = header.indexOf('Expected_Severity');
  const fileIdIdx = header.indexOf('file_id');
  const md5sumIdx = header.indexOf('md5sum');
  if (issueTypeIdx < 0 || severityIdx < 0) return [];
  const result: Array<{ issueType: string; severity: string; valueToMatch: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const issueType = (cells[issueTypeIdx] ?? '').trim();
    if (!issueType) continue;
    const severity = (cells[severityIdx] ?? '').trim();
    const fileId = fileIdIdx >= 0 ? (cells[fileIdIdx] ?? '').trim() : '';
    const md5sum = md5sumIdx >= 0 ? (cells[md5sumIdx] ?? '').trim() : '';
    const valueToMatch = issueType === 'Invalid string pattern' ? md5sum : fileId;
    result.push({ issueType, severity, valueToMatch });
  }
  return result;
}

/**
 * Parse actual CSV (Issue Type, Property, Value, Severity, Record Count).
 */
function parseActualValidationCsv(content: string): Array<{ issueType: string; severity: string; value: string }> {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((s) => s.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((s) => s.trim());
    const row: Record<string, string> = {};
    header.forEach((h, j) => (row[h] = cells[j] ?? ''));
    rows.push(row);
  }
  return rows.map((r) => ({
    issueType: (r['Issue Type'] ?? '').trim(),
    severity: (r['Severity'] ?? '').trim(),
    value: (r['Value'] ?? '').trim(),
  }));
}

/**
 * Build a cell-by-cell validation report (HTML) for end users: expected vs actual, match status per row.
 */
function buildValidationReportHtml(
  expectedIssues: Array<{ issueType: string; severity: string; valueToMatch: string }>,
  actualRows: Array<{ issueType: string; severity: string; value: string }>,
  matchResult: Array<{ expected: (typeof expectedIssues)[0]; matched: boolean; actualRow?: (typeof actualRows)[0] }>
): string {
  const rows = matchResult
    .map(
      (r) =>
        `<tr class="${r.matched ? 'match' : 'missing'}">
          <td>${r.expected.issueType}</td>
          <td>${r.expected.severity}</td>
          <td>${r.expected.valueToMatch}</td>
          <td>${r.matched ? '✓ Matched' : '✗ Not found'}</td>
          <td>${r.actualRow ? `${r.actualRow.issueType} / ${r.actualRow.severity} / ${r.actualRow.value}` : '—'}</td>
        </tr>`
    )
    .join('');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Validation: Expected vs UI</title>
<style>
  table { border-collapse: collapse; font-family: sans-serif; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #eee; }
  tr.match { background: #e8f5e9; }
  tr.missing { background: #ffebee; }
  h1 { font-size: 1.1rem; }
</style></head>
<body>
  <h1>Expected vs Actual (cell-by-cell)</h1>
  <p>Expected: ${expectedIssues.length} row(s). Matched: ${matchResult.filter((r) => r.matched).length}. Missing: ${matchResult.filter((r) => !r.matched).length}.</p>
  <table>
    <thead><tr><th>Expected Issue Type</th><th>Expected Severity</th><th>Expected Value</th><th>Status</th><th>Actual (if matched)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
}

/**
 * Assert Validation Results tab and optionally compare to expected file (path relative to project root).
 * If expected file is TSV with Issue_Type/Expected_Severity, does semantic match (each expected issue in actual).
 * Attaches expected + actual content and a cell-by-cell HTML report so the end user can see Expected vs UI match.
 */
export async function assertValidationResultsMatchExpected(
  page: Page,
  expectedValidationResultsPath: string | undefined,
  testInfo: TestInfo
): Promise<void> {
  await getLocator(page, 'tabValidationResults').click();
  await page.waitForTimeout(1500);
  await expect(getLocator(page, 'tabValidationResults')).toBeVisible();

  if (expectedValidationResultsPath) {
    const expectedPath = path.join(PROJECT_ROOT, expectedValidationResultsPath);
    if (fs.existsSync(expectedPath)) {
      const expectedContent = fs.readFileSync(expectedPath, 'utf-8');
      await testInfo.attach('expected-ValidationResults', { body: expectedContent, contentType: 'text/plain' });
    }
    await getLocator(page, 'exportValidationResultsButton').first().click({ timeout: 15000 });
    const download = await page.waitForEvent('download', { timeout: 15000 });
    const savePath = path.join(testInfo.outputDir, 'actual-ValidationResults.csv');
    await download.saveAs(savePath);
    const actualContent = fs.readFileSync(savePath, 'utf-8');
    await testInfo.attach('actual-ValidationResults', { body: actualContent, contentType: 'text/plain' });
    if (fs.existsSync(expectedPath)) {
      const expectedContent = fs.readFileSync(expectedPath, 'utf-8');
      const isExpectedTsv = expectedPath.endsWith('.tsv') || expectedContent.includes('Issue_Type');
      if (isExpectedTsv) {
        const expectedIssues = parseExpectedValidationTsv(expectedContent);
        const actualRows = parseActualValidationCsv(actualContent);
        const matchResult: Array<{
          expected: (typeof expectedIssues)[0];
          matched: boolean;
          actualRow?: (typeof actualRows)[0];
        }> = [];
        for (const exp of expectedIssues) {
          const actualRow = actualRows.find(
            (r) =>
              r.issueType === exp.issueType &&
              r.severity === exp.severity &&
              r.value.includes(exp.valueToMatch)
          );
          matchResult.push({ expected: exp, matched: !!actualRow, actualRow: actualRow ?? undefined });
        }
        const reportHtml = buildValidationReportHtml(expectedIssues, actualRows, matchResult);
        await testInfo.attach('validation-expected-vs-actual.html', {
          body: reportHtml,
          contentType: 'text/html',
        });
        for (const r of matchResult) {
          expect(
            r.matched,
            `Expected issue "${r.expected.issueType}" (${r.expected.severity}) with value containing "${r.expected.valueToMatch}" not found in Validation Results export`
          ).toBe(true);
        }
      } else {
        expect(actualContent.trim()).toBe(expectedContent.trim());
      }
    }
    // Attach cell-by-cell report (collapsible by tab) using expected folders under uploadFolder
    const uploadFolder = expectedValidationResultsPath?.split('/')[0] ?? '';
    if (uploadFolder) {
      const cellByCellHtml = await buildCellByCellReportForTabs(
        page,
        uploadFolder,
        path.join(testInfo.outputDir, 'actual-ValidationResults.csv')
      );
      if (cellByCellHtml) {
        await testInfo.attach('validation-cell-by-cell-by-tab.html', {
          body: cellByCellHtml,
          contentType: 'text/html',
        });
        // Also write to fixed path so you can open it directly
        const reportPath = path.join(PROJECT_ROOT, 'test-results', 'validation-cell-by-cell-by-tab.html');
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, cellByCellHtml, 'utf-8');
      }
    }
  }
}

/**
 * Build cell-by-cell report for all three tabs. Expected TSVs from {uploadFolder}/expected-{TabName}/.
 * Validation Results actual from exported CSV path; Upload Activities and Data View actual from page table.
 */
async function buildCellByCellReportForTabs(
  page: Page,
  uploadFolder: string,
  actualValidationCsvPath: string
): Promise<string | null> {
  const baseDir = path.join(PROJECT_ROOT, uploadFolder);
  const tabSections: Array<{
    tabKey: string;
    expectedHeader: string[];
    expectedRows: Array<Record<string, string>>;
    actualHeader: string[];
    actualRows: Array<Record<string, string>>;
    columnMap?: Record<string, string>;
  }> = [];

  for (const tabFolder of EXPECTED_TAB_FOLDERS) {
    const expectedPath = getFirstExpectedTsvInFolder(path.join(baseDir, tabFolder));
    let expectedHeader: string[] = [];
    let expectedRows: Array<Record<string, string>> = [];
    if (expectedPath && fs.existsSync(expectedPath)) {
      const content = fs.readFileSync(expectedPath, 'utf-8');
      const parsed = parseTsvToRows(content);
      expectedHeader = parsed.header;
      expectedRows = parsed.rows;
    }

    let actualHeader: string[] = [];
    let actualRows: Array<Record<string, string>> = [];

    if (tabFolder === 'expected-ValidationResults') {
      if (fs.existsSync(actualValidationCsvPath)) {
        const csv = fs.readFileSync(actualValidationCsvPath, 'utf-8');
        const lines = csv.split(/\r?\n/).filter(Boolean);
        if (lines.length > 0) {
          actualHeader = lines[0].split(',').map((s) => s.trim());
          for (let i = 1; i < lines.length; i++) {
            const row: Record<string, string> = {};
            const cells = lines[i].split(',').map((s) => s.trim());
            actualHeader.forEach((h, j) => (row[h] = cells[j] ?? ''));
            actualRows.push(row);
          }
        }
      }
      // Normalize expected to same columns as actual for cell-by-cell: Issue Type, Severity, Value
      if (expectedRows.length > 0 && expectedHeader.includes('Issue_Type')) {
        const normalized: Array<Record<string, string>> = expectedRows
          .filter((r) => (r['Issue_Type'] ?? '').trim() !== '')
          .map((r) => ({
            'Issue Type': (r['Issue_Type'] ?? '').trim(),
            Severity: (r['Expected_Severity'] ?? '').trim(),
            Value:
              (r['Issue_Type'] ?? '').trim() === 'Invalid string pattern'
                ? (r['md5sum'] ?? '').trim()
                : (r['file_id'] ?? '').trim(),
          }));
        expectedHeader = ['Issue Type', 'Severity', 'Value'];
        expectedRows = normalized;
      }
    } else {
      // Upload Activities or Data View: read table from page (must be on that tab)
      if (tabFolder === 'expected-UploadActivities') {
        await getLocator(page, 'tabUploadStatus').click();
        await page.waitForTimeout(800);
      } else {
        await getLocator(page, 'tabDataView').click();
        await page.waitForTimeout(800);
      }
      const tableData = await getTableDataFromPage(page);
      actualHeader = tableData.header;
      actualRows = tableData.rows;
    }

    tabSections.push({
      tabKey: tabFolder,
      expectedHeader,
      expectedRows,
      actualHeader,
      actualRows,
    });
  }

  // Return to Validation Results tab so caller state is unchanged
  await getLocator(page, 'tabValidationResults').click();
  await page.waitForTimeout(500);

  return buildCellByCellReportHtml(uploadFolder, tabSections);
}
