/**
 * Codegen-style test: Create a Data Submission.
 * Uses scenario data from data-submission-scenarios.json (no hardcoded values).
 */
import { test, expect } from '@playwright/test';
import { loginFromHubPage } from './auth-helpers';
import { getLocator } from './framework/object-repo';
import { loadDataSubmissionScenarios } from './framework/test-data';
import { createDataSubmission } from './helpers/data-submission-helpers';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env');

const allScenarios = loadDataSubmissionScenarios();
const scenarios =
  process.env.SCENARIO != null && process.env.SCENARIO !== ''
    ? allScenarios.filter((s) => s.scenarioId === process.env.SCENARIO)
    : allScenarios;

for (const scenario of scenarios) {
  test(`Create a Data Submission: ${scenario.scenarioId}`, async ({ page }) => {
    await page.goto(BASE_URL + '/');
    await loginFromHubPage(page);

    await getLocator(page, 'dataSubmissionsNavButton').click();
    await page.waitForURL(/\/data-submissions/i, { timeout: 15000 });
    await expect(getLocator(page, 'dataSubmissionsPageTitle')).toBeVisible({ timeout: 10000 });

    await createDataSubmission(page, {
      program: scenario.program,
      study: scenario.study,
      submissionName: scenario.submissionName,
      dataCommons: scenario.dataCommons,
    });

    await expect(getLocator(page, 'tableColumnSubmissionName')).toBeVisible({ timeout: 10000 });
  });
}
