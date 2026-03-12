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
  const loaded = JSON.parse(raw) as TestCaseRow[];
  testCases = loaded;
  return loaded;
}

export function getTestCase(scenarioId: string): TestCaseRow | undefined {
  return loadTestCases().find((r) => r.scenarioId === scenarioId);
}

export interface DataSubmissionScenario {
  scenarioId: string;
  submissionName: string;
  program: string;
  study: string;
  dataCommons: string;
  uploadFolder: string;
  expectedValidationResults: string;
}

let dataSubmissionScenarios: DataSubmissionScenario[] | null = null;

export function loadDataSubmissionScenarios(): DataSubmissionScenario[] {
  if (dataSubmissionScenarios) return dataSubmissionScenarios;
  const jsonPath = path.join(DATA_DIR, 'data-submission-scenarios.json');
  if (!fs.existsSync(jsonPath)) return [];
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const loaded = JSON.parse(raw) as DataSubmissionScenario[];
  dataSubmissionScenarios = loaded;
  return loaded;
}

export function getDataSubmissionScenario(scenarioId: string): DataSubmissionScenario | undefined {
  return loadDataSubmissionScenarios().find((r) => r.scenarioId === scenarioId);
}
