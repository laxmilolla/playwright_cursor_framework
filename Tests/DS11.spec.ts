import { test, expect } from '@playwright/test';
import { loginFromHubPage } from './auth-helpers';
import { getLocator } from './framework/object-repo';
import { getTestCase } from './framework/test-data';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env (e.g. https://hub-stage.datacommons.cancer.gov)');

test.describe('Data Submissions', () => {
  test('DS11: Create a Data Submission', async ({ page }) => {
    const row = getTestCase('DS11');
    if (!row) throw new Error('Test case DS11 not found in test-cases.json');
    const { filterValue: submissionName } = row;

    await page.goto(BASE_URL + '/');
    await loginFromHubPage(page);

    await page.getByRole('link', { name: /data submissions/i }).click();
    await page.waitForURL(/\/data-submissions/i, { timeout: 15000 });

    await expect(getLocator(page, 'dataSubmissionsPageTitle')).toBeVisible({ timeout: 10000 });
    await getLocator(page, 'createDataSubmissionButton').click();

    // Data Commons: open dropdown and select CTDC
    await getLocator(page, 'createDialogDataCommonsTrigger').click();
    await page.waitForTimeout(400);
    await getLocator(page, 'createDialogDataCommonsOptionCTDC').click();
    await page.waitForTimeout(400);

    await getLocator(page, 'createDialogSelectButton').click();
    await page.waitForTimeout(500);

    // Study: options use dynamic testId (study-option-<uuid>), select first
    await page.locator('[data-testid^="study-option-"]').first().click({ timeout: 10000 });
    await page.waitForTimeout(400);

    await getLocator(page, 'createDialogSubmissionNameInput').fill(submissionName);
    await getLocator(page, 'createDialogCreateButton').click();

    // Expect dialog to close and list to be visible (or submission to appear)
    await page.waitForTimeout(2000);
    await expect(getLocator(page, 'dataSubmissionsPageTitle')).toBeVisible({ timeout: 10000 });
    await expect(getLocator(page, 'tableColumnSubmissionName')).toBeVisible({ timeout: 10000 });
  });
});
