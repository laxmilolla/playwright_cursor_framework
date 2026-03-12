import { test, expect } from '@playwright/test';
import { getLocator } from './framework/object-repo';
import { getTestCase } from './framework/test-data';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env (e.g. https://caninecommons.cancer.gov for CC tests)');

test.describe('Canine Commons Explore', () => {
  test('Canine Commons: Explore, filter by Program (COP), verify data and all tabs', async ({ page }) => {
    const row = getTestCase('CC2');
    if (!row) throw new Error('Test case CC2 not found');
    const filterValue = row.filterValue;

    await page.goto(BASE_URL);
    await getLocator(page, 'ccContinueButton').click();
    await getLocator(page, 'ccExploreLink').click();

    await expect(getLocator(page, 'ccProgramFacetButton')).toBeVisible({ timeout: 10000 });
    await getLocator(page, 'ccProgramFacetButton').click();
    await expect(getLocator(page, 'ccProgramFacetCheckbox')).toBeVisible({ timeout: 10000 });
    await getLocator(page, 'ccProgramFacetCheckbox').check();
    await page.waitForTimeout(2000);

    await expect(page.getByText(new RegExp(filterValue, 'i')).first()).toBeVisible({ timeout: 10000 });

    await getLocator(page, 'ccTabCases').click();
    await expect(getLocator(page, 'ccTabCases')).toBeVisible({ timeout: 5000 });

    await getLocator(page, 'ccTabSamples').click();
    await expect(getLocator(page, 'ccTabSamples')).toBeVisible({ timeout: 5000 });

    await getLocator(page, 'ccTabCaseFiles').click();
    await expect(getLocator(page, 'ccTabCaseFiles')).toBeVisible({ timeout: 5000 });

    await getLocator(page, 'ccTabStudyFiles').click();
    await expect(getLocator(page, 'ccTabStudyFiles')).toBeVisible({ timeout: 5000 });
  });
});
