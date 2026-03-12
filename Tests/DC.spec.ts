import * as path from 'path';
import * as fs from 'fs';
import { test, expect } from '@playwright/test';
import { loginFromHubPage } from './auth-helpers';
import { getLocator } from './framework/object-repo';
import { loadDataSubmissionScenarios } from './framework/test-data';
import {
  createDataSubmission,
  openSubmissionByName,
  uploadFilesFromFolder,
  runValidations,
  assertUploadStatusTab,
  assertDataViewTab,
  assertValidationResultsMatchExpected,
} from './helpers/data-submission-helpers';

const PROJECT_ROOT = path.resolve(process.cwd());
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL in .env');

const allScenarios = loadDataSubmissionScenarios();
const scenarios =
  process.env.SCENARIO != null && process.env.SCENARIO !== ''
    ? allScenarios.filter((s) => s.scenarioId === process.env.SCENARIO)
    : allScenarios;

for (const scenario of scenarios) {
  test.describe(`Data submission flow: ${scenario.scenarioId}`, () => {
    test(`DC: Create → Open → Upload (${scenario.uploadFolder}) → Validate → Assert tabs`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
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

      await openSubmissionByName(page, scenario.submissionName);

      await uploadFilesFromFolder(page, scenario.uploadFolder);

      await runValidations(page);

      const uploadDir = path.join(PROJECT_ROOT, scenario.uploadFolder);
      const expectedFileCount = fs.existsSync(uploadDir)
        ? fs.readdirSync(uploadDir).filter((f) => f.endsWith('.tsv')).length
        : undefined;
      await assertUploadStatusTab(page, expectedFileCount);

      await assertDataViewTab(page);

      await assertValidationResultsMatchExpected(
        page,
        scenario.expectedValidationResults,
        testInfo
      );
    });
  });
}
