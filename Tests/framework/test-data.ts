import * as path from 'path';
import * as fs from 'fs';

export interface TestCaseRow {
  scenarioId: string;
  filterType: string;
  filterValue: string;
  expectedInColumn: string;
  expectedVisible: string;
  notes: string;
}

let testCases: TestCaseRow[] | null = null;

const DATA_DIR = path.join(__dirname, '..', 'data');

export function loadTestCases(): TestCaseRow[] {
  if (testCases) return testCases;
  const jsonPath = path.join(DATA_DIR, 'test-cases.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  testCases = JSON.parse(raw);
  return testCases;
}

export function getTestCase(scenarioId: string): TestCaseRow | undefined {
  return loadTestCases().find((r) => r.scenarioId === scenarioId);
}
