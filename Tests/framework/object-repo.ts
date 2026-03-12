import type { Page, Locator } from '@playwright/test';
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

/** Page and Locator both have getByRole, getByTestId, getByLabel, getByText, locator — used for scoped lookups. */
type PageOrLocator = Page | Locator;

/**
 * Returns a Playwright locator for the given object name using the object repository.
 * When devs change the UI, update Tests/data/objects.json (or the Excel and re-export).
 * @param pageOrScope - Page (whole page) or Locator (e.g. dialog) to scope the lookup to.
 */
export function getLocator(pageOrScope: PageOrLocator, objectName: string) {
  const map = loadObjects();
  const row = map.get(objectName);
  if (!row) throw new Error(`Object not found in repo: ${objectName}`);

  const { selectorType, selectorValue } = row;
  const base = pageOrScope;

  switch (selectorType) {
    case 'heading':
      return base.getByRole('heading', { name: selectorValue, level: 1 });
    case 'role+name': {
      const [role, name] = selectorValue.split(':').map((s) => s.trim());
      const roleKey = role as 'button' | 'link' | 'textbox' | 'tab' | 'radio' | 'dialog';
      return base.getByRole(roleKey, { name });
    }
    case 'role+name+nth': {
      const parts = selectorValue.split(':').map((s) => s.trim());
      const role = parts[0] as 'button' | 'link' | 'textbox' | 'tab' | 'radio';
      const name = parts[1];
      const nth = parseInt(parts[2] ?? '0', 10);
      return base.getByRole(role, { name }).nth(nth);
    }
    case 'role+name+last': {
      const [role, name] = selectorValue.split(':').map((s) => s.trim());
      const roleKey = role as 'button' | 'link' | 'textbox' | 'tab' | 'radio';
      return base.getByRole(roleKey, { name }).last();
    }
    case 'role':
      return base.getByRole(selectorValue as 'listbox');
    case 'text':
      return base.getByText(selectorValue).first();
    case 'button':
      return base.getByRole('button', { name: new RegExp(selectorValue, 'i') });
    case 'input':
    case 'dropdown':
      return base.getByLabel(selectorValue);
    case 'testId':
      return base.getByTestId(selectorValue);
    case 'testId+button': {
      const colonIndex = selectorValue.indexOf(':');
      const testId = colonIndex >= 0 ? selectorValue.slice(0, colonIndex).trim() : selectorValue;
      const buttonName = colonIndex >= 0 ? selectorValue.slice(colonIndex + 1).trim() : '';
      return base.getByTestId(testId).getByRole('button', { name: buttonName });
    }
    case 'tab':
      return base.getByRole('tab', { name: new RegExp(selectorValue, 'i') });
    case 'radio':
      return base.getByRole('radio', { name: new RegExp(selectorValue, 'i') });
    case 'testIdPrefix':
      return base.locator('[data-testid^="' + selectorValue + '"]');
    default:
      return base.getByText(selectorValue).first();
  }
}

/**
 * Returns a locator for objects that need a runtime value (e.g. option by text, link by name).
 * Use for selectorType "testIdPrefix+filterByText" or "linkByText" — see objects.json notes.
 */
export function getLocatorWithValue(page: Page, objectName: string, value: string) {
  const map = loadObjects();
  const row = map.get(objectName);
  if (!row) throw new Error(`Object not found in repo: ${objectName}`);
  const { selectorType, selectorValue } = row;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');
  if (selectorType === 'testIdPrefix+filterByText') {
    return page.locator('[data-testid^="' + selectorValue + '"]').filter({ hasText: re }).first();
  }
  if (selectorType === 'linkByText') {
    return page.getByRole('link', { name: re });
  }
  throw new Error(`getLocatorWithValue: unsupported selectorType ${selectorType} for ${objectName}`);
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
  const optionBySubmitterTestId = page.locator('[data-testid^="submitter-name-option-"]').filter({ hasText: new RegExp(optionText, 'i') }).first();

  try {
    await optionByRole.click({ timeout: 2000 });
  } catch {
    try {
      await optionByOrgTestId.click({ timeout: 2000 });
    } catch {
      try {
        await optionByStatusTestId.click({ timeout: 2000 });
      } catch {
        try {
          await optionByDataCommonsTestId.click({ timeout: 5000 });
        } catch {
          await optionBySubmitterTestId.click({ timeout: 2000 });
        }
      }
    }
  }

  await page.waitForTimeout(400);
}

export { loadObjects };
