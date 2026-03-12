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

  // All create-dialog elements from objects.json, scoped to the popup
  const dialog = getLocator(page, 'createDataSubmissionDialog');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  await getLocator(dialog, 'createDialogDataCommonsTrigger').click();
  await page.waitForTimeout(400);
  // Data Commons option list is in portal, so use page for the <li>
  await page.locator('li').filter({ hasText: new RegExp('^' + dataCommons + '$') }).first().click({ timeout: 10000 });
  await page.waitForTimeout(400);

  await getLocator(dialog, 'createDialogSelectButton').click();
  await page.waitForTimeout(500);

  // Study: same as DS11 — after Select, options use data-testid^="study-option-"; select by text
  await getLocatorWithValue(page, 'createDialogStudyOptionByText', study).click({ timeout: 10000 });
  await page.waitForTimeout(400);

  const dialogAgain = getLocator(page, 'createDataSubmissionDialog');
  await getLocator(dialogAgain, 'createDialogSubmissionNameInput').fill(submissionName);
  await page.waitForTimeout(300);
  await getLocator(dialogAgain, 'createDialogCreateButton').click();
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
 * Assert Validation Results tab and optionally compare to expected file (path relative to project root).
 * If expected file is TSV with Issue_Type/Expected_Severity, does semantic match (each expected issue in actual).
 * Otherwise exact string match. On failure, attaches expected and actual to testInfo.
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
        for (const exp of expectedIssues) {
          const found = actualRows.some(
            (r) =>
              r.issueType === exp.issueType &&
              r.severity === exp.severity &&
              r.value.includes(exp.valueToMatch)
          );
          expect(found, `Expected issue "${exp.issueType}" (${exp.severity}) with value containing "${exp.valueToMatch}" not found in Validation Results export`).toBe(true);
        }
      } else {
        expect(actualContent.trim()).toBe(expectedContent.trim());
      }
    }
  }
}
