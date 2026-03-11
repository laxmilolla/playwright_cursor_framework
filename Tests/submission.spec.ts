import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginFromHubPage } from './auth-helpers';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env (e.g. https://hub-stage.datacommons.cancer.gov)');

test.describe('Hub Submission', () => {
  test('go to hub-stage and click Submission link', async ({ page }) => {
    await page.goto(BASE_URL + '/');

    // Always run login flow (email, password, TOTP, Grant)
    await loginFromHubPage(page);

    // Click the Submission Requests button
    await page.getByRole('button', { name: 'Submission Requests' }).click();

    // Verify we navigated to the submission-requests page
    await expect(page).toHaveURL(/submission-requests/i);

    // Search for submission name "laxmi"
    await page.getByTestId('submitter-name-input').fill('laxmi');
    await page.getByTestId('submitter-name-input').press('Enter');

    // Wait a moment for results to load, then take screenshot (before assertion so we get it even if test fails)
    await page.waitForTimeout(2000);
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'after-laxmi-search.png') });

    // Verify search results show "laxmi"
    await expect(page.getByText(/laxmi/i).first()).toBeVisible({ timeout: 10000 });
  });
});
