import type { Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export interface ObjectRow {
  objectName: string;
  page: string;
  selectorType: string;
  selectorValue: string;
  notes?: string;
}

let objectsMap: Map<string, ObjectRow> | null = null;

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadObjects(): Map<string, ObjectRow> {
  if (objectsMap) return objectsMap;
  const jsonPath = path.join(DATA_DIR, 'objects.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const rows: ObjectRow[] = JSON.parse(raw);
  objectsMap = new Map(rows.map((r) => [r.objectName, r]));
  return objectsMap;
}

/**
 * Returns a Playwright locator for the given object name using the object repository.
 * When devs change the UI, update Tests/data/objects.json (or the Excel and re-export).
 */
export function getLocator(page: Page, objectName: string) {
  const map = loadObjects();
  const row = map.get(objectName);
  if (!row) throw new Error(`Object not found in repo: ${objectName}`);

  const { selectorType, selectorValue } = row;

  switch (selectorType) {
    case 'heading':
      return page.getByRole('heading', { name: selectorValue, level: 1 });
    case 'role+name': {
      const [role, name] = selectorValue.split(':').map((s) => s.trim());
      return page.getByRole(role as 'button' | 'link' | 'textbox', { name });
    }
    case 'text':
      return page.getByText(selectorValue).first();
    case 'button':
      return page.getByRole('button', { name: new RegExp(selectorValue, 'i') });
    case 'input':
    case 'dropdown':
      return page.getByLabel(selectorValue);
    case 'testId':
      return page.getByTestId(selectorValue);
    case 'testId+button': {
      const colonIndex = selectorValue.indexOf(':');
      const testId = colonIndex >= 0 ? selectorValue.slice(0, colonIndex).trim() : selectorValue;
      const buttonName = colonIndex >= 0 ? selectorValue.slice(colonIndex + 1).trim() : '';
      return page.getByTestId(testId).getByRole('button', { name: buttonName });
    }
    default:
      return page.getByText(selectorValue).first();
  }
}

/**
 * Opens the dropdown identified by objectName and selects the option by visible text.
 * Option text comes from test data (e.g. filterValue in test-cases.json).
 * Options use data-testid="organization-option-<uuid>" with dynamic UUIDs; we find by prefix + visible text.
 */
export async function selectDropdownOptionByText(
  page: Page,
  dropdownObjectName: string,
  optionText: string
): Promise<void> {
  const dropdown = getLocator(page, dropdownObjectName);
  await dropdown.click();
  await page.waitForTimeout(400);

  const optionByRole = page.getByRole('option', { name: new RegExp(optionText, 'i') });
  const optionByOrgTestId = page.locator('[data-testid^="organization-option-"]').filter({ hasText: new RegExp(optionText, 'i') }).first();
  const optionByStatusTestId = page.locator('[data-testid^="status-option-"]').filter({ hasText: new RegExp(optionText, 'i') }).first();
  const optionByDataCommonsTestId = page.locator('[data-testid^="data-commons-option-"]').filter({ hasText: new RegExp(optionText, 'i') }).first();

  try {
    await optionByRole.click({ timeout: 2000 });
  } catch {
    try {
      await optionByOrgTestId.click({ timeout: 2000 });
    } catch {
      try {
        await optionByStatusTestId.click({ timeout: 2000 });
      } catch {
        await optionByDataCommonsTestId.click({ timeout: 5000 });
      }
    }
  }

  await page.waitForTimeout(400);
}

export { loadObjects };
