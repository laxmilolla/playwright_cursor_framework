import { test, expect } from '@playwright/test';
import { loginFromHubPage } from './auth-helpers';
import { getLocator } from './framework/object-repo';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env (e.g. https://hub-stage.datacommons.cancer.gov)');

test.describe('Data Submissions', () => {
  test('DS1: Navigate to Data Submissions and verify page', async ({ page }) => {
    await page.goto(BASE_URL + '/');

    await loginFromHubPage(page);

    // Navigate via UI (direct /data-submissions URL may redirect to home)
    await page.getByRole('link', { name: /data submissions/i }).click();
    await page.waitForURL(/\/data-submissions/i, { timeout: 15000 });

    await expect(getLocator(page, 'dataSubmissionsPageTitle')).toBeVisible({ timeout: 10000 });
    await expect(getLocator(page, 'createDataSubmissionButton')).toBeVisible({ timeout: 10000 });
    await expect(getLocator(page, 'tableColumnSubmissionName')).toBeVisible({ timeout: 10000 });
  });
});
