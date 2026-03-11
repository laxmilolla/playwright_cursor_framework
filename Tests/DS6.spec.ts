import { test, expect } from '@playwright/test';
import { loginFromHubPage } from './auth-helpers';
import { getLocator, selectDropdownOptionByText } from './framework/object-repo';
import { getTestCase } from './framework/test-data';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env (e.g. https://hub-stage.datacommons.cancer.gov)');

test.describe('Data Submissions', () => {
  test('DS6: Filter by Submitter', async ({ page }) => {
    const row = getTestCase('DS6');
    if (!row) throw new Error('Test case DS6 not found in test-cases.json');
    const { filterValue, expectedVisible } = row;

    await page.goto(BASE_URL + '/');
    await loginFromHubPage(page);

    await page.getByRole('link', { name: /data submissions/i }).click();
    await page.waitForURL(/\/data-submissions/i, { timeout: 15000 });

    await expect(getLocator(page, 'dataSubmissionsPageTitle')).toBeVisible({ timeout: 10000 });

    await selectDropdownOptionByText(page, 'filterSubmitter', filterValue);

    await page.waitForTimeout(2000);

    if (expectedVisible === 'true') {
      await expect(page.getByText(new RegExp(filterValue, 'i')).first()).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText(new RegExp(filterValue, 'i'))).not.toBeVisible();
    }
  });
});
